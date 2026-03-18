const http = require('http');

const data = {
    objectives: [
        {
            id: 'obj_1',
            title: 'Test Objective',
            owner: 'Test Owner',
            description: 'Test Desc',
            dueDate: '2026-12-31',
            createdAt: '2026-03-09T11:00:00.000Z',
            initiatives: [
                {
                    id: 'ini_1',
                    objectiveId: 'obj_1',
                    title: 'Test Initiative',
                    owner: 'Test Owner',
                    description: 'Test Desc',
                    dueDate: '2026-12-31',
                    createdAt: '2026-03-09T11:00:00.000Z',
                    tasks: [
                        {
                            id: 'task_1',
                            initiativeId: 'ini_1',
                            title: 'Test Task',
                            description: 'Test Desc',
                            assignee: 'Test Assignee',
                            priority: 'Alta',
                            dueDate: '2026-12-31',
                            completed: false,
                            completedAt: null
                        }
                    ]
                }
            ]
        }
    ]
};

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/save',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
}, (res) => {
    let body = '';
    res.on('data', (chunk) => {
        body += chunk;
    });
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Body: ${body}`);
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(JSON.stringify(data));
req.end();
