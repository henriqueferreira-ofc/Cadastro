import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(__dirname, '../../audit.log');

export const auditLog = (action: string, details: string) => {
    const entry = `${new Date().toISOString()} | ${action} | ${details}\n`;
    fs.appendFileSync(LOG_FILE, entry);
};
