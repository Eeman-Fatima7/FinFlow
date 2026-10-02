from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
import pathlib
import base64
import os
import time
import json
import re
import hashlib
import urllib.error
import urllib.parse
import urllib.request
import categorizer
from forecasting import build_personalized_forecast, ALLOWED_HORIZONS
from import_engine import extract_statement
from import_engine.adapters import adapt_textract_blocks_to_rows
from stocks.yfinance_enrichment import (
    assert_statement as assert_stock_statement,
    assert_ticker as assert_stock_ticker,
    get_fundamentals_enrichment,
    get_profile_enrichment,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

# ── Startup / Shutdown ────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load model at startup
    print("\n[ML Service] Loading categorization model...")
    try:
        categorizer.load_model()
        print("[ML Service] Ready\n")
    except FileNotFoundError as e:
        print(f"[ML Service] WARNING: {e}")
        print("[ML Service] Run 'python train.py' to train the model first.\n")
    yield
    # Cleanup on shutdown (nothing needed)


# ── App ───────────────────────────────────────────────────────

app = FastAPI(
    title="Finance Advisor — ML Microservice",
    description="Expense categorization and forecasting",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────

class CategorizeRequest(BaseModel):
    description: str = Field(..., min_length=1, example="Careem Ride - Lahore")
    merchant: Optional[str] = Field(default="", example="Careem")
    amount: Optional[float] = Field(default=0.0, ge=0, example=2397.0)
    direction: Optional[str] = Field(default="unknown", example="debit")
    source_bank: Optional[str] = Field(default="unknown", example="easypaisa")
    channel: Optional[str] = Field(default="unknown", example="wallet_transfer")
    has_fees: Optional[float] = Field(default=0.0, ge=0)
    has_tax: Optional[float] = Field(default=0.0, ge=0)
    is_credit_origin: Optional[float] = Field(default=0.0, ge=0, le=1)
    counterparty: Optional[str] = Field(default="")
    recurring_flag: Optional[float] = Field(default=0.0, ge=0, le=1)


class PredictionItem(BaseModel):
    category: str
    confidence: float


class CategorizeResponse(BaseModel):
    category: str
    confidence: float
    source: str
    top_predictions: List[PredictionItem]
    margin: Optional[float] = None
    ambiguous: Optional[bool] = None
    model_version: Optional[str] = None


class ForecastProjection(BaseModel):
    year: int
    month: int
    predicted_total_expenses: float
    predicted_total_income: float
    predicted_total_savings: float
    savings_rate: float


class ForecastReliability(BaseModel):
    history_months_available: int
    history_months_used: int
    used_profile_income_fallback: bool
    fallback_mode: str
    confidence_level: str
    quality_flags: List[str]


class ForecastCategoryOutlook(BaseModel):
    category: str
    predicted_monthly_spend: float


class ForecastResponse(BaseModel):
    user_id: int
    month: int
    year: int
    predicted_total_expenses: float
    predicted_total_savings: float
    savings_rate: float
    method: str
    based_on_records: int
    horizon_months: int
    projections: List[ForecastProjection]
    reliability: ForecastReliability
    category_outlook: List[ForecastCategoryOutlook] = Field(default_factory=list)


class ForecastRequest(BaseModel):
    user_id: int
    horizon_months: int = Field(default=1)
    history_payload: Dict[str, Any]


class StatementExtractRequest(BaseModel):
    file_name: str = Field(..., min_length=1)
    mime_type: str = Field(..., min_length=1)
    content_base64: str = Field(..., min_length=1)
    bank_hint: Optional[str] = None
    user_id: Optional[int] = None
    import_session_id: Optional[str] = None


class StatementExtractFixtureRequest(BaseModel):
    fixture_name: str = Field(..., min_length=1)
    source_type: Optional[str] = Field(default=None)
    source_bank: Optional[str] = Field(default="unknown")


BACKEND_SERVICE_URL = os.getenv("BACKEND_SERVICE_URL", "http://localhost:5000")
INTERNAL_FORECAST_KEY = os.getenv("INTERNAL_FORECAST_KEY", "")
TEXTRACT_FIXTURE_DIR = pathlib.Path(__file__).resolve().parent / "import_engine" / "fixtures" / "textract"


def trim_text(value: Any, max_length: int = 300) -> Optional[str]:
    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None

    if len(text) > max_length:
        return f"{text[: max_length - 1]}…"

    return text


def sanitize_value(value: Any, depth: int = 0) -> Any:
    if depth > 2:
        return None

    if value is None:
        return None

    if isinstance(value, (bool, int, float)):
        return value

    if isinstance(value, str):
        return trim_text(value)

    if isinstance(value, list):
        return [sanitize_value(item, depth + 1) for item in value[:12]]

    if isinstance(value, dict):
        output: Dict[str, Any] = {}
        for key in list(value.keys())[:40]:
            normalized_key = trim_text(str(key), 80)
            if not normalized_key:
                continue
            output[normalized_key] = sanitize_value(value.get(key), depth + 1)
        return output

    return trim_text(str(value), 300)


def make_correlation_id() -> str:
    return hashlib.sha256(f"{time.time_ns()}-{os.getpid()}".encode("utf-8")).hexdigest()[:16]


def get_correlation_id(request: Optional[Request]) -> str:
    if request is None:
        return make_correlation_id()

    for header_name in ("x-correlation-id", "x-request-id", "x-trace-id"):
        value = request.headers.get(header_name)
        trimmed = trim_text(value, 120)
        if trimmed:
            return trimmed

    return make_correlation_id()


def log_event(
    *,
    service: str,
    operation: str,
    status: str,
    correlation_id: Optional[str] = None,
    user_id: Optional[int] = None,
    latency_ms: Optional[float] = None,
    fallback_used: bool = False,
    error: Optional[Exception] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    event = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "event_type": "observability",
        "service": trim_text(service, 80) or "ml",
        "operation": trim_text(operation, 120) or "unknown_operation",
        "status": trim_text(status, 40) or "info",
        "correlation_id": trim_text(correlation_id, 120) or make_correlation_id(),
        "user_id": int(user_id) if isinstance(user_id, int) else None,
        "latency_ms": round(float(latency_ms), 2) if isinstance(latency_ms, (int, float)) else None,
        "fallback_used": bool(fallback_used),
        "error_class": trim_text(error.__class__.__name__, 120) if error else None,
        "error_message": trim_text(str(error), 400) if error else None,
        "details": sanitize_value(details or {}),
    }

    try:
        print(json.dumps(event, ensure_ascii=False))
    except Exception:
        pass


def elapsed_ms(started_at: float) -> float:
    return round((time.perf_counter() - started_at) * 1000, 2)


def normalize_source_type(value: Optional[str]) -> Optional[str]:
    if not isinstance(value, str):
        return None
    lowered = value.strip().lower()
    return lowered if lowered in {"pdf", "image"} else None


def sanitize_fixture_name(value: str) -> Optional[str]:
    if not isinstance(value, str):
        return None
    candidate = value.strip()
    if not candidate:
        return None
    if not re.fullmatch(r"[A-Za-z0-9._-]+", candidate):
        return None
    return candidate


def infer_fixture_source_type(name: str) -> str:
    lowered = name.lower()
    if "image" in lowered:
        return "image"
    return "pdf"


def fetch_history_payload(user_id: int, months_back: int = 18) -> Dict[str, Any]:
    if not INTERNAL_FORECAST_KEY:
        raise RuntimeError("INTERNAL_FORECAST_KEY is not configured")

    url = f"{BACKEND_SERVICE_URL}/forecast/internal/history/{user_id}"

    query = urllib.parse.urlencode({"months_back": months_back})
    full_url = f"{url}?{query}" if query else url

    req = urllib.request.Request(
        full_url,
        headers={"x-internal-forecast-key": INTERNAL_FORECAST_KEY},
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=8) as response:
            status_code = response.getcode()
            raw_body = response.read().decode("utf-8")
    except urllib.error.HTTPError as http_err:
        if http_err.code == 404:
            raise HTTPException(status_code=404, detail="User not found for forecast history")
        body = http_err.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Failed to fetch forecast history: {http_err.code} {body}")

    if status_code >= 400:
        raise RuntimeError(f"Failed to fetch forecast history: {status_code}")

    try:
        payload = json.loads(raw_body)
    except Exception:
        raise RuntimeError("Invalid forecast history payload")

    if not isinstance(payload, dict):
        raise RuntimeError("Invalid forecast history payload")

    return payload


def validate_horizon(horizon_months: int) -> int:
    if horizon_months not in ALLOWED_HORIZONS:
        raise HTTPException(
            status_code=400,
            detail=f"horizon_months must be one of {sorted(ALLOWED_HORIZONS)}",
        )
    return horizon_months


# ── Routes ────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "ML microservice is running ✓"}


@app.get("/health")
def health():
    model_loaded = categorizer._pipeline is not None
    model_version = "unknown"

    if isinstance(categorizer._feature_meta, dict):
        raw_version = categorizer._feature_meta.get("model_version")
        if raw_version:
            model_version = str(raw_version)

    return {
        "status":       "ok" if model_loaded else "model_not_loaded",
        "model_loaded": model_loaded,
        "model_version": model_version,
    }


@app.get("/ml/stocks/profile/{ticker}")
def stock_profile_enrichment(ticker: str, request: Request):
    started_at = time.perf_counter()
    correlation_id = get_correlation_id(request)

    try:
        validated_ticker = assert_stock_ticker(ticker)
        payload = get_profile_enrichment(validated_ticker)

        log_event(
            service="ml",
            operation="stocks_profile_enrichment",
            status="ok",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=False,
            details={
                "ticker": validated_ticker,
                "has_description": bool(payload.get("description")),
                "has_ceo": bool(payload.get("ceo")),
            },
        )

        return payload
    except ValueError as e:
        log_event(
            service="ml",
            operation="stocks_profile_enrichment",
            status="error",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={
                "ticker": trim_text(ticker, 20),
                "reason": "validation_error",
            },
        )
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException as e:
        log_event(
            service="ml",
            operation="stocks_profile_enrichment",
            status="error",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={
                "ticker": trim_text(ticker, 20),
            },
        )
        raise
    except Exception as e:
        log_event(
            service="ml",
            operation="stocks_profile_enrichment",
            status="error",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={
                "ticker": trim_text(ticker, 20),
                "reason": "yfinance_error",
            },
        )
        raise HTTPException(status_code=503, detail="Stock enrichment service unavailable")


@app.get("/ml/stocks/fundamentals/{ticker}")
def stock_fundamentals_enrichment(
    ticker: str,
    request: Request,
    statement: str = Query(default="income"),
):
    started_at = time.perf_counter()
    correlation_id = get_correlation_id(request)

    try:
        validated_ticker = assert_stock_ticker(ticker)
        validated_statement = assert_stock_statement(statement)
        rows = get_fundamentals_enrichment(validated_ticker, validated_statement)

        log_event(
            service="ml",
            operation="stocks_fundamentals_enrichment",
            status="ok",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=False,
            details={
                "ticker": validated_ticker,
                "statement": validated_statement,
                "row_count": len(rows),
            },
        )

        return {
            "statement": validated_statement,
            "rows": rows,
        }
    except ValueError as e:
        log_event(
            service="ml",
            operation="stocks_fundamentals_enrichment",
            status="error",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={
                "ticker": trim_text(ticker, 20),
                "statement": trim_text(statement, 20),
                "reason": "validation_error",
            },
        )
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException as e:
        log_event(
            service="ml",
            operation="stocks_fundamentals_enrichment",
            status="error",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={
                "ticker": trim_text(ticker, 20),
                "statement": trim_text(statement, 20),
            },
        )
        raise
    except Exception as e:
        log_event(
            service="ml",
            operation="stocks_fundamentals_enrichment",
            status="error",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={
                "ticker": trim_text(ticker, 20),
                "statement": trim_text(statement, 20),
                "reason": "yfinance_error",
            },
        )
        raise HTTPException(status_code=503, detail="Stock enrichment service unavailable")


@app.post("/ml/categorize", response_model=CategorizeResponse)
def categorize(request_body: CategorizeRequest, request: Request):
    """
    Predict the expense category for a transaction.
    Called by the Node.js backend when a transaction is added.
    """
    started_at = time.perf_counter()
    correlation_id = get_correlation_id(request)

    if categorizer._pipeline is None:
        err = HTTPException(
            status_code=503,
            detail="Model not loaded. Run 'python train.py' first."
        )
        log_event(
            service="ml",
            operation="categorize_single",
            status="error",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=err,
            details={"reason": "model_not_loaded"},
        )
        raise err

    try:
        result = categorizer.predict(
            description=request_body.description,
            merchant=request_body.merchant or "",
            amount=request_body.amount or 0.0,
            direction=request_body.direction or "unknown",
            source_bank=request_body.source_bank or "unknown",
            channel=request_body.channel or "unknown",
            has_fees=request_body.has_fees or 0.0,
            has_tax=request_body.has_tax or 0.0,
            is_credit_origin=request_body.is_credit_origin or 0.0,
            counterparty=request_body.counterparty or "",
            recurring_flag=request_body.recurring_flag or 0.0,
        )

        log_event(
            service="ml",
            operation="categorize_single",
            status="ok",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=False,
            details={
                "source": result.get("source"),
                "category": result.get("category"),
                "confidence": result.get("confidence"),
                "ambiguous": result.get("ambiguous"),
            },
        )

        return result
    except HTTPException as e:
        log_event(
            service="ml",
            operation="categorize_single",
            status="error",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
        )
        raise
    except Exception as e:
        log_event(
            service="ml",
            operation="categorize_single",
            status="error",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ml/forecast/personalized", response_model=ForecastResponse)
def forecast_personalized(request_body: ForecastRequest, request: Request):
    """
    Build personalized forecast from backend-provided user monthly aggregates.
    """
    started_at = time.perf_counter()
    correlation_id = get_correlation_id(request)

    try:
        horizon = validate_horizon(request_body.horizon_months)
        result = build_personalized_forecast(
            user_id=request_body.user_id,
            history_payload=request_body.history_payload,
            horizon_months=horizon,
        )

        reliability = result.get("reliability") if isinstance(result, dict) else {}
        reliability = reliability if isinstance(reliability, dict) else {}

        log_event(
            service="ml",
            operation="forecast_personalized",
            status="ok",
            correlation_id=correlation_id,
            user_id=request_body.user_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=bool(reliability.get("used_profile_income_fallback")),
            details={
                "horizon_months": horizon,
                "based_on_records": result.get("based_on_records") if isinstance(result, dict) else None,
                "confidence_level": reliability.get("confidence_level"),
                "quality_flags": reliability.get("quality_flags") or [],
            },
        )

        return result
    except HTTPException as e:
        log_event(
            service="ml",
            operation="forecast_personalized",
            status="error",
            correlation_id=correlation_id,
            user_id=request_body.user_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={"horizon_months": request_body.horizon_months},
        )
        raise
    except ValueError as e:
        log_event(
            service="ml",
            operation="forecast_personalized",
            status="error",
            correlation_id=correlation_id,
            user_id=request_body.user_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={"horizon_months": request_body.horizon_months},
        )
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log_event(
            service="ml",
            operation="forecast_personalized",
            status="error",
            correlation_id=correlation_id,
            user_id=request_body.user_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={"horizon_months": request_body.horizon_months},
        )
        raise HTTPException(status_code=500, detail=f"Forecast error: {e}")


@app.get("/ml/forecast/{user_id}", response_model=ForecastResponse)
def forecast(
    user_id: int,
    request: Request,
    horizon_months: int = Query(default=1, ge=1, le=12),
):
    """
    Backward-compatible forecast endpoint now backed by personalized user history.
    """
    started_at = time.perf_counter()
    correlation_id = get_correlation_id(request)

    try:
        horizon = validate_horizon(horizon_months)
        history_payload = fetch_history_payload(user_id=user_id, months_back=18)
        result = build_personalized_forecast(
            user_id=user_id,
            history_payload=history_payload,
            horizon_months=horizon,
        )

        reliability = result.get("reliability") if isinstance(result, dict) else {}
        reliability = reliability if isinstance(reliability, dict) else {}

        log_event(
            service="ml",
            operation="forecast_internal_history",
            status="ok",
            correlation_id=correlation_id,
            user_id=user_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=bool(reliability.get("used_profile_income_fallback")),
            details={
                "horizon_months": horizon,
                "based_on_records": result.get("based_on_records") if isinstance(result, dict) else None,
                "confidence_level": reliability.get("confidence_level"),
                "quality_flags": reliability.get("quality_flags") or [],
            },
        )

        return result
    except HTTPException as e:
        log_event(
            service="ml",
            operation="forecast_internal_history",
            status="error",
            correlation_id=correlation_id,
            user_id=user_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={"horizon_months": horizon_months},
        )
        raise
    except urllib.error.URLError as e:
        log_event(
            service="ml",
            operation="forecast_internal_history",
            status="error",
            correlation_id=correlation_id,
            user_id=user_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={"horizon_months": horizon_months},
        )
        raise HTTPException(status_code=503, detail=f"Forecast history service unavailable: {e}")
    except Exception as e:
        log_event(
            service="ml",
            operation="forecast_internal_history",
            status="error",
            correlation_id=correlation_id,
            user_id=user_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={"horizon_months": horizon_months},
        )
        raise HTTPException(status_code=500, detail=f"Forecast error: {e}")


@app.post("/ml/categorize/batch")
def categorize_batch(requests: list[CategorizeRequest], request: Request):
    """
    Categorize multiple transactions at once.
    Useful for bulk CSV imports.
    """
    started_at = time.perf_counter()
    correlation_id = get_correlation_id(request)

    if categorizer._pipeline is None:
        err = HTTPException(status_code=503, detail="Model not loaded.")
        log_event(
            service="ml",
            operation="categorize_batch",
            status="error",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=err,
            details={
                "rows_total": len(requests),
                "reason": "model_not_loaded",
            },
        )
        raise err

    results = []
    error_count = 0

    for req in requests:
        try:
            result = categorizer.predict(
                description=req.description,
                merchant=req.merchant or "",
                amount=req.amount or 0.0,
                direction=req.direction or "unknown",
                source_bank=req.source_bank or "unknown",
                channel=req.channel or "unknown",
                has_fees=req.has_fees or 0.0,
                has_tax=req.has_tax or 0.0,
                is_credit_origin=req.is_credit_origin or 0.0,
                counterparty=req.counterparty or "",
                recurring_flag=req.recurring_flag or 0.0,
            )
            results.append({"input": req.description, **result})
        except Exception as e:
            error_count += 1
            results.append({"input": req.description, "error": str(e)})

    status = "ok" if error_count == 0 else ("degraded" if error_count < len(requests) else "error")

    log_event(
        service="ml",
        operation="categorize_batch",
        status=status,
        correlation_id=correlation_id,
        latency_ms=elapsed_ms(started_at),
        fallback_used=error_count > 0,
        details={
            "rows_total": len(requests),
            "rows_error": error_count,
            "rows_success": len(requests) - error_count,
        },
    )

    return {"results": results, "total": len(results)}


@app.post("/ml/extract/statement")
def extract_statement_endpoint(request_body: StatementExtractRequest, request: Request):
    started_at = time.perf_counter()
    correlation_id = get_correlation_id(request)

    try:
        content_bytes = base64.b64decode(request_body.content_base64)
    except Exception as e:
        log_event(
            service="ml",
            operation="extract_statement",
            status="error",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={
                "file_name": request_body.file_name,
                "mime_type": request_body.mime_type,
                "stage": "base64_decode",
            },
        )
        raise HTTPException(status_code=400, detail="Invalid base64 file content")

    if not content_bytes:
        err = HTTPException(status_code=400, detail="Uploaded file content is empty")
        log_event(
            service="ml",
            operation="extract_statement",
            status="error",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=err,
            details={
                "file_name": request_body.file_name,
                "mime_type": request_body.mime_type,
                "stage": "content_validation",
            },
        )
        raise err

    try:
        extraction = extract_statement(
            file_name=request_body.file_name,
            mime_type=request_body.mime_type,
            content_bytes=content_bytes,
            bank_hint=request_body.bank_hint,
            user_id=request_body.user_id,
            import_session_id=request_body.import_session_id,
        )

        pages_processed = extraction.pages_processed
        parser_name = extraction.parser_name
        extraction_provider = extraction.extraction_provider or (
            "textract" if parser_name == "textract_statement_adapter" else "legacy"
        )

        payload = {
            "rows": extraction.rows,
            "source_type": extraction.source_type,
            "source_bank": extraction.source_bank,
            "parser_name": parser_name,
            "detection_confidence": extraction.detection_confidence,
            "used_ocr": extraction.used_ocr,
            "warnings": extraction.warnings,
            "extraction_provider": extraction_provider,
            "pages_processed": pages_processed,
        }

        warnings = extraction.warnings if isinstance(extraction.warnings, list) else []

        log_event(
            service="ml",
            operation="extract_statement",
            status="degraded" if extraction.used_ocr else "ok",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=bool(extraction.used_ocr),
            details={
                "file_name": request_body.file_name,
                "mime_type": request_body.mime_type,
                "bank_hint": request_body.bank_hint,
                "user_id": request_body.user_id,
                "import_session_id": request_body.import_session_id,
                "source_type": extraction.source_type,
                "source_bank": extraction.source_bank,
                "parser_name": extraction.parser_name,
                "detection_confidence": extraction.detection_confidence,
                "used_ocr": extraction.used_ocr,
                "extraction_provider": extraction_provider,
                "pages_processed": pages_processed,
                "rows_extracted": len(extraction.rows),
                "warning_count": len(warnings),
            },
        )

        return payload
    except ValueError as e:
        log_event(
            service="ml",
            operation="extract_statement",
            status="error",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={
                "file_name": request_body.file_name,
                "mime_type": request_body.mime_type,
            },
        )
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log_event(
            service="ml",
            operation="extract_statement",
            status="error",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={
                "file_name": request_body.file_name,
                "mime_type": request_body.mime_type,
            },
        )
        raise HTTPException(status_code=500, detail=f"Statement extraction failed: {e}")


@app.post("/ml/extract/statement-fixture")
def extract_statement_fixture_endpoint(request_body: StatementExtractFixtureRequest, request: Request):
    started_at = time.perf_counter()
    correlation_id = get_correlation_id(request)

    fixture_name = sanitize_fixture_name(request_body.fixture_name)
    if not fixture_name:
        raise HTTPException(status_code=400, detail="Invalid fixture_name")

    fixture_path = TEXTRACT_FIXTURE_DIR / fixture_name
    if not fixture_path.exists() or not fixture_path.is_file():
        raise HTTPException(status_code=404, detail="Fixture not found")

    try:
        with fixture_path.open("r", encoding="utf-8") as file:
            payload = json.load(file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Unable to load fixture: {e}")

    blocks = payload.get("Blocks", []) if isinstance(payload, dict) else []
    if not isinstance(blocks, list) or not blocks:
        raise HTTPException(status_code=400, detail="Fixture does not contain Textract blocks")

    inferred_type = infer_fixture_source_type(fixture_name)
    source_type = normalize_source_type(request_body.source_type) or inferred_type
    source_bank = trim_text(request_body.source_bank, 60) or "unknown"

    try:
        adapted = adapt_textract_blocks_to_rows(
            blocks=blocks,
            source_type=source_type,
            source_bank=source_bank,
        )

        if not adapted.rows:
            raise HTTPException(status_code=400, detail="Fixture produced no transaction rows")

        pages = {
            int(block.get("Page") or 1)
            for block in blocks
            if isinstance(block, dict)
        }

        response_payload = {
            "rows": adapted.rows,
            "source_type": source_type,
            "source_bank": source_bank,
            "parser_name": "textract_statement_adapter",
            "detection_confidence": adapted.average_confidence,
            "used_ocr": False,
            "warnings": adapted.warnings,
            "extraction_provider": "textract",
            "pages_processed": len(pages) if pages else 1,
        }

        log_event(
            service="ml",
            operation="extract_statement_fixture",
            status="ok",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=False,
            details={
                "fixture_name": fixture_name,
                "source_type": source_type,
                "source_bank": source_bank,
                "rows_extracted": len(adapted.rows),
                "warning_count": len(adapted.warnings),
            },
        )

        return response_payload
    except HTTPException:
        raise
    except Exception as e:
        log_event(
            service="ml",
            operation="extract_statement_fixture",
            status="error",
            correlation_id=correlation_id,
            latency_ms=elapsed_ms(started_at),
            fallback_used=True,
            error=e,
            details={
                "fixture_name": fixture_name,
                "source_type": source_type,
                "source_bank": source_bank,
            },
        )
        raise HTTPException(status_code=500, detail=f"Fixture extraction failed: {e}")