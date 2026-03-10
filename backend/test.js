require('dotenv').config();
const { fetchBoards } = require('./mondayClient');

const token = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjYzMTAwNTU4OSwiYWFpIjoxMSwidWlkIjoxMDA4MTI5OTcsImlhZCI6IjIwMjYtMDMtMTBUMDU6NDE6NDEuMDAwWiIsInBlciI6Im1lOndyaXRlIiwiYWN0aWQiOjM0MTUzNDI1LCJyZ24iOiJhcHNlMiJ9.MlMpZIdn_57ZL6eAtpszMnzyDaX0X52qWdoTEXvLp4A';

fetchBoards(token).then(boards => {
  console.log('BOARDS FOUND:', boards.length);
  boards.forEach(b => console.log(' -', b.id, b.name));
}).catch(err => {
  console.log('ERROR:', err.message);
});
