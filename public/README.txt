Empty on purpose: Plesk document root for the Node.js app.
Keeping it empty makes every request go to Express (server.js) instead of
Apache/nginx serving repo files (server/, schema.sql, ...) directly.
