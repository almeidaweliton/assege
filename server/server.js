const express = require('express');
const cors = require('cors');
const path = require('path');
const { run, all } = require('./database');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Get all data
app.get('/api/data', async (req, res) => {
    try {
        const objectives = await all('SELECT * FROM objectives_top');
        const initiatives = await all('SELECT * FROM initiatives');
        const tasks = await all('SELECT * FROM tasks');

        // Map hierarchy
        const data = {
            objectives: objectives.map(obj => ({
                ...obj,
                initiatives: initiatives.filter(ini => ini.objectiveId === obj.id).map(ini => ({
                    ...ini,
                    tasks: tasks.filter(t => t.initiativeId === ini.id).map(t => ({
                        ...t,
                        completed: !!t.completed
                    }))
                }))
            }))
        };

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save complete state
app.post('/api/save', async (req, res) => {
    const { objectives } = req.body;
    const dataToSave = objectives || [];

    try {
        await run('BEGIN TRANSACTION');

        await run('DELETE FROM tasks');
        await run('DELETE FROM initiatives');
        await run('DELETE FROM objectives_top');

        for (const obj of dataToSave) {
            await run(
                'INSERT INTO objectives_top (id, title, owner, description, dueDate, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
                [obj.id, obj.title, obj.owner, obj.description, obj.dueDate, obj.createdAt]
            );

            if (obj.initiatives && obj.initiatives.length > 0) {
                for (const ini of obj.initiatives) {
                    await run(
                        'INSERT INTO initiatives (id, objectiveId, title, owner, description, dueDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [ini.id, obj.id, ini.title, ini.owner, ini.description, ini.dueDate, ini.createdAt]
                    );

                    if (ini.tasks && ini.tasks.length > 0) {
                        for (const task of ini.tasks) {
                            await run(
                                'INSERT INTO tasks (id, initiativeId, title, description, assignee, priority, dueDate, completed, completedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                [task.id, ini.id, task.title, task.description, task.assignee, task.priority, task.dueDate, task.completed ? 1 : 0, task.completedAt]
                            );
                        }
                    }
                }
            }
        }

        await run('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await run('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`To access from other computers, use your machine IP instead of localhost`);
});
