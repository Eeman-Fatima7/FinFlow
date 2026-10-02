const { getStockProfile, getStockOverview, getStockIndicators } = require('./stockService');
const advisorService = require('../advisorService');

const normalizeAction = (value) => {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (raw === 'BUY' || raw === 'HOLD' || raw === 'SELL') return raw;
  return 'HOLD';
};

const toNumberOrNull = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toRoundedOrNull = (value, digits = 2) => {
  const numeric = toNumberOrNull(value);
  if (numeric === null) return null;
  return Number(numeric.toFixed(digits));
};

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeRationale = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => toTrimmedString(item))
    .filter(Boolean)
    .slice(0, 6);
};

const ensureFutureIso = (value) => {
  const parsed = new Date(value);
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  return new Date().toISOString();
};

const extractJsonObject = (text) => {
  const trimmed = toTrimmedString(text);
  if (!trimmed) return null;

  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

    try {
      const sliced = candidate.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(sliced);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      return null;
    } catch {
      return null;
    }
  }
};

const buildFallbackSummary = ({ ticker, profile, overview, indicators }) => {
  const points = [];

  if (typeof overview?.month_change_pct === 'number') {
    points.push(`1M performance: ${overview.month_change_pct.toFixed(2)}%`);
  }

  if (typeof indicators?.rsi === 'number') {
    points.push(`RSI: ${indicators.rsi.toFixed(2)}`);
  }

  if (indicators?.macd_trend) {
    points.push(`MACD trend: ${indicators.macd_trend}`);
  }

  if (typeof profile?.pe === 'number') {
    points.push(`P/E: ${profile.pe.toFixed(2)}`);
  }

  const rationale = points.length > 0 ? points : ['Insufficient structured market evidence'];

  return {
    action: 'HOLD',
    target_price: profile?.current_price ?? null,
    target_price_currency: profile?.price_currency || 'USD',
    potential_pct: 0,
    confidence_pct: 35,
    summary: `Conservative fallback for ${ticker}: hold until stronger confirming signals are available.`,
    rationale,
    as_of: new Date().toISOString(),
  };
};

const coerceInsightsPayload = ({ rawObject, ticker, profile, fallback }) => {
  if (!rawObject) return fallback;

  const targetPrice = toRoundedOrNull(rawObject.target_price, 2);
  const currentPrice = toNumberOrNull(profile?.current_price);
  const potentialPct = (() => {
    const explicit = toRoundedOrNull(rawObject.potential_pct, 2);
    if (explicit !== null) return explicit;

    if (targetPrice !== null && currentPrice !== null && currentPrice !== 0) {
      return toRoundedOrNull(((targetPrice - currentPrice) / currentPrice) * 100, 2);
    }

    return null;
  })();

  const confidence = (() => {
    const explicit = toRoundedOrNull(rawObject.confidence_pct, 2);
    if (explicit === null) return 35;
    return Math.min(100, Math.max(0, explicit));
  })();

  const summary = toTrimmedString(rawObject.summary)
    || `AI generated a ${normalizeAction(rawObject.action)} stance for ${ticker}.`;

  const rationale = normalizeRationale(rawObject.rationale);

  return {
    action: normalizeAction(rawObject.action),
    target_price: targetPrice,
    target_price_currency: profile?.price_currency || fallback.target_price_currency || 'USD',
    potential_pct: potentialPct,
    confidence_pct: confidence,
    summary,
    rationale: rationale.length > 0 ? rationale : fallback.rationale,
    as_of: ensureFutureIso(rawObject.as_of || new Date().toISOString()),
  };
};

const buildPrompt = ({ ticker, profile, overview, indicators }) => {
  const companyName = profile?.company_name || ticker;

  const systemPrompt = `You are a conservative stock research assistant.
Return ONLY strict JSON with keys:
action, target_price, potential_pct, confidence_pct, summary, rationale, as_of.
Constraints:
- action must be BUY, HOLD, or SELL.
- target_price and potential_pct are numbers or null.
- confidence_pct is 0-100.
- summary <= 80 words.
- rationale is an array of 2-5 short evidence bullets.
- as_of must be ISO-8601 timestamp.
Do not include markdown, prose outside JSON, or extra keys.`;

  const userPrompt = `Analyze ${ticker} (${companyName}) with these latest signals:
profile:
- current_price: ${profile?.current_price}
- daily_change_percent: ${profile?.daily_change_percent}
- pe: ${profile?.pe}
- eps: ${profile?.eps}
- sector: ${profile?.sector}
overview:
- day_change_pct: ${overview?.day_change_pct}
- week_change_pct: ${overview?.week_change_pct}
- month_change_pct: ${overview?.month_change_pct}
- quarter_change_pct: ${overview?.quarter_change_pct}
indicators:
- rsi: ${indicators?.rsi}
- macd_trend: ${indicators?.macd_trend}
- fifty_two_week_low: ${indicators?.fifty_two_week_low}
- fifty_two_week_high: ${indicators?.fifty_two_week_high}

Provide a conservative, evidence-bounded stance.`;

  return { systemPrompt, userPrompt };
};

const generateStockInsights = async ({ ticker, correlationId = null, userId = null }) => {
  const [profile, overview, indicators] = await Promise.all([
    getStockProfile({ ticker }),
    getStockOverview({ ticker }),
    getStockIndicators({ ticker }),
  ]);

  const fallback = buildFallbackSummary({ ticker, profile, overview, indicators });

  let modelText = '';
  try {
    modelText = await advisorService.callLLM(
      buildPrompt({ ticker, profile, overview, indicators }),
      {
        correlationId,
        userId,
        channel: 'stocks',
      }
    );
  } catch {
    return {
      ...fallback,
      model_fallback_used: true,
      evidence: {
        profile,
        overview,
        indicators,
      },
    };
  }

  const parsed = extractJsonObject(modelText);
  const data = coerceInsightsPayload({
    rawObject: parsed,
    ticker,
    profile,
    fallback,
  });

  return {
    ...data,
    model_fallback_used: parsed === null,
    evidence: {
      profile,
      overview,
      indicators,
    },
  };
};

module.exports = {
  generateStockInsights,
};
