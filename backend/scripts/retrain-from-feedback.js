const path = require('path');
const { spawn } = require('child_process');
const { exportFeedbackTrainingData } = require('./export-feedback-training-data');

const ROOT_DIR = path.resolve(__dirname, '../..');
const ML_DIR = path.resolve(ROOT_DIR, 'ml');
const TRAIN_SCRIPT = path.resolve(ML_DIR, 'train.py');

const runPython = ({ scriptPath, args = [] }) =>
  new Promise((resolve, reject) => {
    const commandArgs = [scriptPath, ...args];
    const proc = spawn('python', commandArgs, {
      cwd: ML_DIR,
      stdio: 'inherit',
      env: {
        ...process.env,
        PYTHONUTF8: '1',
      },
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`python exited with status ${code}`));
    });
  });

const retrainFromFeedback = async ({ modelVersion } = {}) => {
  const versionTag =
    modelVersion || `feedback-${new Date().toISOString().replace(/[.:]/g, '-')}`;

  const exportSummary = await exportFeedbackTrainingData();

  await runPython({
    scriptPath: TRAIN_SCRIPT,
    args: [
      '--feedback-file',
      exportSummary.output_file,
      '--model-version',
      versionTag,
    ],
  });

  return {
    model_version: versionTag,
    feedback_export: exportSummary,
    train_script: TRAIN_SCRIPT,
  };
};

if (require.main === module) {
  retrainFromFeedback()
    .then((summary) => {
      console.log('Retraining completed successfully');
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Retraining failed:', error.message);
      process.exit(1);
    });
}

module.exports = {
  retrainFromFeedback,
};
