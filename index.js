const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    let jsonData = {
        message: 'Hello, World from Express!',
        status: 'success'
    };
    res.json(jsonData);
});


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}/`);
});
