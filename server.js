const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (CSS, images, etc.)
app.use(express.static('public'));

// Create a connection to MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Rbsangeeta56',      // Your MySQL root password
    database: 'hospital_db'  // Your database name
});

// Connect to the database
db.connect((err) => {
    if (err) throw err;
    console.log('Connected to the MySQL database');
});

// Serve the registration page
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Serve the patient login page
app.get('/login/patient', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'patient-login.html'));
});

// Serve the doctor login page
app.get('/login/doctor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'doctor-login.html'));
});

// Patient login route
app.post('/patient-login', (req, res) => {
    const { username, password } = req.body;

    const query = 'SELECT * FROM users WHERE username = ? AND role = "patient"';
    db.query(query, [username], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            const user = results[0];
            if (bcrypt.compareSync(password, user.password)) {
                // Redirect to patient.html on successful login
                return res.redirect('/patient.html');
            } else {
                return res.send('Invalid password');
            }
        } else {
            return res.send('User not found');
        }
    });
});

// Doctor login route
app.post('/doctor-login', (req, res) => {
    const { username, password } = req.body;

    const query = 'SELECT * FROM users WHERE username = ? AND role = "doctor"';
    db.query(query, [username], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            const user = results[0];
            if (bcrypt.compareSync(password, user.password)) {
                // Redirect to doctor.html on successful login
                return res.redirect('/doctor.html');
            } else {
                return res.send('Invalid password');
            }
        } else {
            return res.send('User not found');
        }
    });
});


// Registration route for /register 
app.post('/register', (req, res) => {
    const { fullname, email, username, password, role } = req.body;

    // Make sure role is received correctly
    if (!role) {
        return res.send('Role is required');
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const query = 'INSERT INTO users (fullname, email, username, password, role) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [fullname, email, username, hashedPassword, role], (err, result) => {
        if (err) throw err;
        return res.send('User registered successfully');
    });
});



// Appointment booking route
app.post('/submit-appointment', (req, res) => {
    const { name, email, phone, date, time, doctor } = req.body;

    const query = 'INSERT INTO appointments (full_name, email, phone_number, appointment_date, appointment_time, doctor) VALUES (?, ?, ?, ?, ?, ?)';
    
    db.query(query, [name, email, phone, date, time, doctor], (err, result) => {
        if (err) throw err;
        console.log('Appointment booked successfully');
        res.send('Appointment booked successfully');
    });
});


// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
