const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');  // Import session middleware

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (CSS, images, etc.)
app.use(express.static('public'));

// Configure session middleware (Move this to the top before your routes)
app.use(session({
    secret: 'your_secret_key', // Use a secure key for production
    resave: false,
    saveUninitialized: true
}));

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
                // Store the username in the session
                req.session.username = user.username;

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
                req.session.username = user.username; // Store username in session
                return res.redirect('/doctor.html');
            } else {
                return res.send('Invalid password');
            }
        } else {
            return res.send('User not found');
        }
    });
});

// Fetch appointments for the logged-in doctor
app.get('/doctor-appointments', (req, res) => {
    if (!req.session.username) {
        return res.status(403).send('Unauthorized');
    }

    const doctorUsername = req.session.username;
    const query = 'SELECT * FROM appointments WHERE doctor = ? ORDER BY appointment_date, appointment_time';
    
    db.query(query, [doctorUsername], (err, results) => {
        if (err) throw err;
        res.json(results); // Send appointments as JSON
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
        return res.redirect('/index.html');
    });
});

// Appointment booking route
app.post('/submit-appointment', (req, res) => {
    const { name, email, phone, date, time, doctor } = req.body;

    // Start transaction to ensure atomicity
    db.beginTransaction((err) => {
        if (err) throw err;

        // Check if the slot is already booked for the given doctor and date
        const checkAvailabilityQuery = 'SELECT * FROM appointments WHERE doctor = ? AND appointment_date = ? AND appointment_time = ? FOR UPDATE';
        db.query(checkAvailabilityQuery, [doctor, date, time], (err, results) => {
            if (err) {
                return db.rollback(() => {
                    throw err;
                });
            }

            if (results.length > 0) {
                // If the slot is already booked, send an error response and rollback transaction
                return db.rollback(() => {
                    return res.redirect('/AlreadyBook.html');
                });
            } else {
                // Slot is available, proceed with the booking
                const appointmentQuery = 'INSERT INTO appointments (full_name, email, phone_number, appointment_date, appointment_time, doctor) VALUES (?, ?, ?, ?, ?, ?)';
                
                db.query(appointmentQuery, [name, email, phone, date, time, doctor], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            throw err;
                        });
                    }

                    const appointmentId = result.insertId; // Capture the inserted appointment ID

                    // Now insert into the bill table
                    const billQuery = 'INSERT INTO bill (appointment_id, patient_name, doctor_name, appointment_date, appointment_time, amount) VALUES (?, ?, ?, ?, ?, ?)';
                    const fees = 500;  // Static fee for appointment

                    db.query(billQuery, [appointmentId, name, doctor, date, time, fees], (err, billResult) => {
                        if (err) {
                            return db.rollback(() => {
                                throw err;
                            });
                        }

                        // Commit the transaction if all queries succeeded
                        db.commit((err) => {
                            if (err) {
                                return db.rollback(() => {
                                    throw err;
                                });
                            }

                            // Store appointment and bill details in session
                            req.session.appointmentDetails = {
                                name,
                                email,
                                phone,
                                date,
                                time,
                                doctor,
                                billId: billResult.insertId,  // Use bill ID from the inserted row in the bill table
                                fees: fees
                            };

                            return res.redirect('/confirm-booking');
                        });
                    });
                });
            }
        });
    });
});




// Route to serve the confirmation page
app.get('/confirm-booking', (req, res) => {
    if (!req.session.appointmentDetails) {
        return res.redirect('/'); // Redirect to home if no appointment details
    }
    res.sendFile(path.join(__dirname, 'public', 'ConfirmBooking.html'));
});

// Fetch appointment details for confirmation
app.get('/get-confirmation-details', (req, res) => {
    if (!req.session.appointmentDetails) {
        return res.status(403).send('Unauthorized');
    }
    
    // Send session data including bill ID and fees
    res.json(req.session.appointmentDetails);
});

// Fetch list of doctors for the appointment form
app.get('/doctors', (req, res) => {
    const query = 'SELECT username, fullname FROM users WHERE role = "doctor"';
    db.query(query, (err, results) => {
        if (err) throw err;
        res.json(results); // Send list of doctors as JSON
    });
});

// Fetch available time slots based on selected doctor and date
app.get('/available-times', (req, res) => {
    const doctor = req.query.doctor;
    const date = req.query.date;

    const startHour = 9; // Clinic starts at 9 AM
    const endHour = 17; // Clinic ends at 5 PM

    // Fetch all appointments for the doctor on the selected date
    const query = 'SELECT appointment_time FROM appointments WHERE doctor = ? AND appointment_date = ?';
    db.query(query, [doctor, date], (err, results) => {
        if (err) throw err;

        // Extract booked times
        const bookedTimes = results.map(appointment => appointment.appointment_time);

        // Create available time slots, spaced 30 minutes apart
        const availableTimes = [];
        for (let hour = startHour; hour < endHour; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                if (!bookedTimes.includes(time)) {
                    availableTimes.push(time);
                }
            }
        }

        res.json(availableTimes);
    });
});

// Prescription submission route
app.post('/submit-prescription', (req, res) => {
    const { bill_id, patient_name, doctor_name, medicines, amount, admit_patient, disease, nurse_name, ward_number } = req.body;

    const query = 'UPDATE bill SET amount = ?, disease = ?, nurse_name = ?, ward_number = ? WHERE bill_id = ?';
    
    db.query(query, [amount, admit_patient ? disease : null, admit_patient ? nurse_name : null, admit_patient ? ward_number : null, bill_id], (err, result) => {
        if (err) throw err;
        res.send('Prescription and bill updated successfully');
    });
});

// Fetch bill details
app.get('/get-bill-details/:appointment_id', (req, res) => {
    const { appointment_id } = req.params;

    const query = 'SELECT * FROM bill WHERE appointment_id = ?';
    db.query(query, [appointment_id], (err, results) => {
        if (err) throw err;
        res.json(results); // Send bill details
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
