const fs = require('fs/promises');
const path = require('path');
const db = require('../db/db');

const OUTPUT_FILE = path.resolve(__dirname, '../../ml/data/corrections_feedback.csv');

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const csvEscape = (value) => {
  const text = String(value ?? '');
  if (/[,"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const normalizeDirection = (value) => {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === 'credit' || normalized === 'income') return 'credit';
  if (normalized === 'debit' || normalized === 'expense') return 'debit';
  return 'unknown';
};

const normalizeSourceToken = (value) => {
  const normalized = toTrimmedString(value).toLowerCase();
  if (!normalized || normalized === 'n/a' || normalized === 'na') return 'unknown';
  return normalized;
};

const shouldKeepRow = (row) => {
  const finalCategory = toTrimmedString(row.final_category_name);
  const merchant = toTrimmedString(row.merchant || row.normalized_merchant);
  const description = toTrimmedString(row.description || row.normalized_description);
  const signalType = toTrimmedString(row.signal_type).toLowerCase();

  if (!finalCategory) return false;
  if (!merchant && !description) return false;

  const hasPredictionContext =
    row.predicted_category_name ||
    row.predicted_confidence !== null ||
    row.predicted_source;

  if (!hasPredictionContext && signalType !== 'label') {
    return false;
  }

  return true;
};

const dedupeRows = (rows) => {
  const seen = new Set();
  const output = [];

  rows.forEach((row) => {
    const key = [
      toTrimmedString(row.description || row.normalized_description).toLowerCase(),
      toTrimmedString(row.merchant || row.normalized_merchant).toLowerCase(),
      Number.isFinite(Number(row.amount)) ? Number(row.amount).toFixed(2) : '',
      toTrimmedString(row.final_category_name).toLowerCase(),
      normalizeDirection(row.direction),
      normalizeSourceToken(row.source_bank),
      normalizeSourceToken(row.channel),
      toTrimmedString(row.feedback_kind).toLowerCase(),
    ].join('|');

    if (seen.has(key)) return;
    seen.add(key);
    output.push(row);
  });

  return output;
};

const buildCsvRows = (rows) => {
  const header = [
    'description',
    'merchant',
    'amount',
    'category',
    'direction',
    'source_bank',
    'channel',
    'signal_type',
    'feedback_kind',
    'predicted_category',
    'predicted_confidence',
    'predicted_source',
    'predicted_margin',
    'predicted_ambiguous',
    'model_version',
    'created_at',
  ];

  const lines = [header.join(',')];

  rows.forEach((row) => {
    const line = [
      csvEscape(toTrimmedString(row.description || row.normalized_description)),
      csvEscape(toTrimmedString(row.merchant || row.normalized_merchant)),
      csvEscape(Number.isFinite(Number(row.amount)) ? Number(row.amount).toFixed(2) : ''),
      csvEscape(toTrimmedString(row.final_category_name)),
      csvEscape(normalizeDirection(row.direction)),
      csvEscape(normalizeSourceToken(row.source_bank)),
      csvEscape(normalizeSourceToken(row.channel)),
      csvEscape(toTrimmedString(row.signal_type).toLowerCase()),
      csvEscape(toTrimmedString(row.feedback_kind).toLowerCase()),
      csvEscape(toTrimmedString(row.predicted_category_name)),
      csvEscape(row.predicted_confidence === null ? '' : Number(row.predicted_confidence).toFixed(4)),
      csvEscape(toTrimmedString(row.predicted_source).toLowerCase()),
      csvEscape(row.predicted_margin === null ? '' : Number(row.predicted_margin).toFixed(4)),
      csvEscape(typeof row.predicted_ambiguous === 'boolean' ? String(row.predicted_ambiguous) : ''),
      csvEscape(toTrimmedString(row.model_version)),
      csvEscape(row.created_at ? new Date(row.created_at).toISOString() : ''),
    ];

    lines.push(line.join(','));
  });

  return lines.join('\n');
};

const markRowsExported = async ({ ids, batchId }) => {
  if (!Array.isArray(ids) || ids.length === 0) return;

  await db.query(
    `UPDATE category_feedback_events
     SET
       used_for_training = TRUE,
       export_batch_id = $1,
       exported_at = NOW()
     WHERE feedback_event_id = ANY($2::bigint[])`,
    [batchId, ids]
  );
};

const exportFeedbackTrainingData = async ({ outputFile = OUTPUT_FILE } = {}) => {
  const query = await db.query(
    `SELECT
      feedback_event_id,
      feedback_kind,
      signal_type,
      predicted_category_name,
      predicted_confidence,
      predicted_source,
      predicted_margin,
      predicted_ambiguous,
      final_category_name,
      merchant,
      normalized_merchant,
      description,
      normalized_description,
      amount,
      direction,
      source_bank,
      channel,
      model_version,
      created_at
     FROM category_feedback_events
     WHERE final_category_name IS NOT NULL
     ORDER BY created_at ASC`
  );

  const filtered = query.rows.filter(shouldKeepRow);
  const deduped = dedupeRows(filtered);
  const csvText = buildCsvRows(deduped);

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${csvText}\n`, 'utf-8');

  const batchId = `feedback_${new Date().toISOString().replace(/[.:]/g, '-')}`;
  await markRowsExported({
    ids: deduped.map((row) => Number(row.feedback_event_id)).filter(Number.isFinite),
    batchId,
  });

  return {
    output_file: outputFile,
    batch_id: batchId,
    total_events: query.rows.length,
    exported_rows: deduped.length,
    skipped_rows: query.rows.length - deduped.length,
  };
};

if (require.main === module) {
  exportFeedbackTrainingData()
    .then((summary) => {
      console.log('Feedback export completed');
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Feedback export failed:', error.message);
      process.exit(1);
    });
}

module.exports = {
  exportFeedbackTrainingData,
};
