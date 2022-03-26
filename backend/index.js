const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mysql = require('mysql');
const cors = require('cors');
const { Server } = require('socket.io');
const axios = require('axios');
const { stringify } = require('querystring');
const { client } = require('websocket');
const qs = require('qs');
const { access } = require('fs');
const cookieParser = require('cookie-parser');
require('dotenv').config()

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_IP,
  credentials: true
}));

const server = http.createServer(app);
const PORT = process.env.BACKEND_IP_PORT;
const io = new Server(server, { cors: { origin: "http://192.168.219.116:3000", methods: ["GET", "POST"] } });


dbConfig = {
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME
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

app.get('/oauth/user/info', (req, res) => {
  console.log(req.cookies, req.headers);
  res.json({});
})

app.get('/naver_callback', function (req, res) {

  let client_id = process.env.REACT_APP_NAVER_CLIENT_ID;
  let client_secret = process.env.REACT_APP_NAVER_CLIENT_SECRET;
  let redirectURI = encodeURI(process.env.REACT_APP_CALLBACK_URI);
  let code = req.query.code;
  let callback_state = req.query.state;

  let api_url = 'https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id='
    + client_id + '&client_secret=' + client_secret + '&redirect_uri=' + redirectURI + '&code=' + code + '&state=' + callback_state;

  let access_token;
  let refresh_token;
  let email;
  let domain = 'naver';

  axios({
    method: 'get',
    url: api_url,
    headers: {
      'X-Naver-Client-Id': client_id,
      'X-Naver-Client-Secret': client_secret
    }
  })
    .then(ans => {
      access_token = ans.data.access_token;
      refresh_token = ans.data.refresh_token;

      return axios({
        method: 'get',
        url: 'https://openapi.naver.com/v1/nid/me',
        headers: {
          Authorization: ans.data.token_type + ' ' + access_token
        }
      })
    })
    .then(ans => {
      email = ans.data.response.email;

      res.cookie('key', access_token, {
        httpOnly: true
      }).redirect(process.env.FRONTEND_IP + '/oauth_main');
    });
});

app.get('/kakao_callback', (req, res) => {

  let access_token;
  let refresh_token;
  let email;
  let domain = 'kakao';

  axios({
    method: 'POST',
    url: 'https://kauth.kakao.com/oauth/token',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    data: qs.stringify({
      grant_type: 'authorization_code',
      client_id: process.env.REACT_APP_KAKAO_REST_API_KEY,
      client_secret: process.env.REACT_APP_KAKAO_CLIENT_SECRET,
      redirectUri: '',
      code: req.query.code,
    })
  })
    .then(ans => {
      access_token = ans.data.access_token;
      refresh_token = ans.data.refresh_token;

      return axios({
        method: 'GET',
        url: 'https://kapi.kakao.com//v2/user/me',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-type': 'application/x-www-form-urlencoded;charset=utf-8'
        }
      })
    })
    .then(ans => {
      email = ans.data.email;

      res.cookie('key', access_token, {
        httpOnly: true
      }).redirect(process.env.FRONTEND_IP + '/oauth_main');
    });
})

io.sockets.on("connection", socket => {
  socket.on("join_room", room => {
    socket.join(room);
  })

  socket.on("message", data => {
    socket.to(data.room).emit('message', data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});