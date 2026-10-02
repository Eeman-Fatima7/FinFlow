const {
  getAnomaliesForUser,
  getAnomalySummaryForUser,
  updateAnomalyStatus,
  getTransactionAnomalies,
} = require('../services/anomalies/anomalyRepository');
const { evaluateMonthlyAnomaliesForSummary } = require('../services/anomalies/anomalyOrchestratorService');

const parsePositiveInteger = (value) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
};

const listAnomalies = async (req, res) => {
  const userId = req.userId;

  try {
    const anomalies = await getAnomaliesForUser({
      userId,
      status: req.query.status,
      severity: req.query.severity,
      type: req.query.type,
      month: req.query.month,
      year: req.query.year,
      limit: req.query.limit,
      offset: req.query.offset,
    });

    return res.status(200).json({ anomalies });
  } catch (err) {
    console.error('listAnomalies error:', err.message);
    return res.status(500).json({ error: 'Server error fetching anomalies' });
  }
};

const getAnomaliesSummary = async (req, res) => {
  const userId = req.userId;
  const month = req.query.month ? Number(req.query.month) : null;
  const year = req.query.year ? Number(req.query.year) : null;

  try {
    try {
      await evaluateMonthlyAnomaliesForSummary({
        userId,
        month,
        year,
      });
    } catch (evaluationErr) {
      console.warn('Monthly anomaly evaluation skipped for summary:', evaluationErr.message);
    }

    const summary = await getAnomalySummaryForUser({
      userId,
      month,
      year,
      limit: req.query.limit,
    });

    return res.status(200).json(summary);
  } catch (err) {
    console.error('getAnomaliesSummary error:', err.message);
    return res.status(500).json({ error: 'Server error fetching anomaly summary' });
  }
};

const listTransactionAnomalies = async (req, res) => {
  const userId = req.userId;
  const transactionId = parsePositiveInteger(req.params.id);

  if (!transactionId) {
    return res.status(400).json({ error: 'Invalid transaction id' });
  }

  try {
    const anomalies = await getTransactionAnomalies({
      userId,
      transactionId,
    });

    return res.status(200).json({ anomalies });
  } catch (err) {
    console.error('listTransactionAnomalies error:', err.message);
    return res.status(500).json({ error: 'Server error fetching transaction anomalies' });
  }
};

const markAnomalyRead = async (req, res) => {
  const userId = req.userId;
  const anomalyId = parsePositiveInteger(req.params.id);

  if (!anomalyId) {
    return res.status(400).json({ error: 'Invalid anomaly id' });
  }

  try {
    const anomaly = await updateAnomalyStatus({
      userId,
      anomalyId,
      status: 'read',
    });

    if (!anomaly) {
      return res.status(404).json({ error: 'Anomaly not found' });
    }

    return res.status(200).json({
      message: 'Anomaly marked as read',
      anomaly,
    });
  } catch (err) {
    console.error('markAnomalyRead error:', err.message);
    return res.status(500).json({ error: 'Server error updating anomaly' });
  }
};

const dismissAnomaly = async (req, res) => {
  const userId = req.userId;
  const anomalyId = parsePositiveInteger(req.params.id);

  if (!anomalyId) {
    return res.status(400).json({ error: 'Invalid anomaly id' });
  }

  try {
    const anomaly = await updateAnomalyStatus({
      userId,
      anomalyId,
      status: 'dismissed',
    });

    if (!anomaly) {
      return res.status(404).json({ error: 'Anomaly not found' });
    }

    return res.status(200).json({
      message: 'Anomaly dismissed',
      anomaly,
    });
  } catch (err) {
    console.error('dismissAnomaly error:', err.message);
    return res.status(500).json({ error: 'Server error dismissing anomaly' });
  }
};

module.exports = {
  listAnomalies,
  getAnomaliesSummary,
  listTransactionAnomalies,
  markAnomalyRead,
  dismissAnomaly,
};
