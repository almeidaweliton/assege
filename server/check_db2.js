const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
    db.all("PRAGMA table_info(tasks);", (err, rows) => {
        if (err) console.error(err);
        else console.log('tasks columns:', rows.map(r => r.name));
    });
});
