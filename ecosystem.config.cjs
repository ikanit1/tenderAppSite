/**
 * PM2 ecosystem config для production
 * Запуск: pm2 start ecosystem.config.cjs
 * Из корня проекта (где package.json)
 */
module.exports = {
  apps: [
    {
      name: "tenderbot",
      cwd: "./tenderbot",
      script: "python",
      args: "run.py",
      interpreter: "none",
      env: { PYTHONUNBUFFERED: "1" },
    },
    {
      name: "apisite",
      cwd: ".",
      script: "python",
      args: "-m uvicorn tenderbot.apisite.main:app --host 0.0.0.0 --port 8001 --workers 2",
      interpreter: "none",
      env: {
        PYTHONUNBUFFERED: "1",
        UVICORN_WORKERS: "2",
      },
    },
  ],
};
