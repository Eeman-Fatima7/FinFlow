const {
  previewImportSession,
  getImportSessionForUser,
  confirmImportSession,
} = require('../services/import/importPipelineService');
const { upsertUserCorrectionRule } = require('../services/transactions/merchantCategoryRuleService');
const { recordImportFeedbackEvents } = require('../services/transactions/feedbackLearningService');
const { makeCorrelationId, getRequestCorrelationId } = require('../services/observability/eventLogger');

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const resolveCorrelationId = (req) => getRequestCorrelationId(req) || makeCorrelationId();

const previewImportSessionController = async (req, res) => {
  try {
    const correlationId = resolveCorrelationId(req);

    const payload = await previewImportSession({
      userId: req.userId,
      file: req.file,
      bankHint: req.body?.bank_hint || req.body?.bankHint,
      correlationId,
    });

    return res.status(201).json({
      ...payload,
      correlation_id: correlationId,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    console.error('previewImportSession error:', err.message);
    return res.status(500).json({ error: 'Server error previewing import session' });
  }
};

const getImportSessionController = async (req, res) => {
  try {
    const payload = await getImportSessionForUser({
      userId: req.userId,
      sessionId: req.params.sessionId,
    });

    return res.status(200).json(payload);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    console.error('getImportSession error:', err.message);
    return res.status(500).json({ error: 'Server error loading import session' });
  }
};

const confirmImportSessionController = async (req, res) => {
  try {
    const correlationId = resolveCorrelationId(req);

    const payload = await confirmImportSession({
      userId: req.userId,
      sessionId: req.body?.session_id || req.body?.sessionId,
      updates: req.body?.updates || req.body?.row_updates,
      correlationId,
    });

    const correctionCandidates = Array.isArray(payload.correction_candidates)
      ? payload.correction_candidates
      : [];

    if (correctionCandidates.length > 0) {
      const explicitCorrections = correctionCandidates.filter(
        (candidate) => candidate?.interactionKind === 'explicit_correction'
      );

      if (explicitCorrections.length > 0) {
        await Promise.all(
          explicitCorrections.map((candidate) => {
            const merchant = toTrimmedString(candidate?.merchant);
            const categoryName = toTrimmedString(candidate?.category_final);
            if (!merchant || !categoryName) return null;

            return upsertUserCorrectionRule({
              userId: req.userId,
              pattern: merchant,
              categoryName,
            }).catch(() => null);
          })
        );
      }

      try {
        await recordImportFeedbackEvents({
          userId: req.userId,
          importSessionId: payload.session_id,
          candidates: correctionCandidates,
          metadata: {
            origin: 'transactions.import.confirm',
          },
        });
      } catch (feedbackErr) {
        console.warn('Failed to persist import feedback events:', feedbackErr.message);
      }
    }

    const responsePayload = { ...payload };
    delete responsePayload.correction_candidates;

    return res.status(200).json({
      ...responsePayload,
      correlation_id: correlationId,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    console.error('confirmImportSession error:', err.message);
    return res.status(500).json({ error: 'Server error confirming import session' });
  }
};

module.exports = {
  previewImportSession: previewImportSessionController,
  getImportSession: getImportSessionController,
  confirmImportSession: confirmImportSessionController,
};
