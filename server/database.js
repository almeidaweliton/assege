const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Create Objectives table
    db.run(`CREATE TABLE IF NOT EXISTS objectives_top (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        owner TEXT,
        dueDate TEXT,
        createdAt TEXT
    )`);

    // Create Initiatives table
    db.run(`CREATE TABLE IF NOT EXISTS initiatives (
        id TEXT PRIMARY KEY,
        objectiveId TEXT,
        title TEXT NOT NULL,
        owner TEXT,
        description TEXT,
        dueDate TEXT,
        createdAt TEXT,
        FOREIGN KEY (objectiveId) REFERENCES objectives_top(id) ON DELETE CASCADE
    )`);

    // Add columns to initiatives if migrating from older version
    db.run("ALTER TABLE initiatives ADD COLUMN objectiveId TEXT REFERENCES objectives_top(id) ON DELETE CASCADE", (err) => { });
    db.run("ALTER TABLE initiatives ADD COLUMN owner TEXT", (err) => { });
    db.run("ALTER TABLE initiatives ADD COLUMN description TEXT", (err) => { });

    // Create Tasks table
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        initiativeId TEXT,
        title TEXT NOT NULL,
        description TEXT,
        assignee TEXT,
        priority TEXT,
        dueDate TEXT,
        completed INTEGER,
        completedAt TEXT,
        FOREIGN KEY (initiativeId) REFERENCES initiatives(id) ON DELETE CASCADE
    )`);

    // Add columns to tasks if migrating from older version
    db.run("ALTER TABLE tasks ADD COLUMN initiativeId TEXT REFERENCES initiatives(id) ON DELETE CASCADE", (err) => { });
    db.run("ALTER TABLE tasks ADD COLUMN title TEXT", (err) => { });
    db.run("ALTER TABLE tasks ADD COLUMN description TEXT", (err) => { });
});


const run = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const all = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

module.exports = {
    db,
    run,
    all
};
