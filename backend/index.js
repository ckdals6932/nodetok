const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mysql = require('mysql');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const PORT = 8080;
const io = new Server(server, {cors: {origin: "*", methods: ["GET", "POST"]}});


dbConfig = {
	host: 'localhost',
	user: 'root',
	password: 'qwe123',
	database: 'nodetok'
}

class Database {
	constructor(config) {
		this.connection = mysql.createConnection(config);
	}
	query(sql, args) {
		return new Promise((resolve, reject) => {
			this.connection.query(sql, args, (err, rows) => {
				if (err)
					return reject(err);
				resolve(rows);
			});
		});
	}
	close() {
		return new Promise((resolve, reject) => {
			this.connection.end(err => {
				if (err)
					return reject(err);
				resolve();
			});
		});
	}
}
database = new Database(dbConfig);

app.post('/user/account/signin', (req, res) => {
	console.log(req.body)
	database.query('SELECT * FROM user WHERE id=?', [req.body.id])
		.then(rows => {
			console.log(rows)
			if (rows.length === 0) res.send('wrong id');
			else if (rows[0].password === req.body.password) res.send('login complete');
			else res.send('wrong password');
		});
});

app.post('/user/account/signup', (req, res) => {
	database.query('SELECT id FROM user WHERE id=?', [req.body.id])
		.then(rows => {
			console.log(rows)
			if (rows.length === 0) {
				database.query('INSERT INTO user VALUES (?, ?)', [req.body.id, req.body.password]);
				res.send('create id');
			}
			else {
				res.send('existing id');
			}
		});
});

app.get('/user/:id/rooms', (req, res) => {
	database.query('SELECT * FROM rooms WHERE id=?', [req.params.id])
		.then(rows => {
			res.json(rows);
		});
});

app.get('/user/:id/rooms/admin', (req, res) => {
	database.query('SELECT * FROM rooms WHERE admin_id=?', [req.params.id])
		.then(rows => {
			res.json(rows);
		});
});

app.post('/user/:id/rooms', (req, res) => {
	database.query('SELECT * FROM rooms WHERE room=?', [req.body.room])
		.then(rows => {
			if (rows.length === 0) {
				database.query('INSERT INTO rooms VALUES (?, ?, ?)', [req.params.id, req.params.id, req.body.room]);
				res.send('create room');
			}
			else res.send('existing room');
		});
})

app.post('/user/:id/rooms/:room', (req, res) => {
	console.log(req.params)
	database.query('SELECT * FROM rooms WHERE room=?', [req.params.room])
		.then(rows => {
			if (rows.length === 0) {
				res.send('not existing room');
			}
			else if (rows[0].id === req.params.id) {
				res.send('already existing room');
			}
			else {
				database.query('INSERT INTO rooms VALUES (?, ?, ?)', [rows[0].admin_id, req.params.id, rows[0].room]);
			}
			res.send('join room');
		})
});

io.sockets.on("connection", socket => {
    socket.on("message", data => {
		console.log(data);
		io.sockets.emit('message', data);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});