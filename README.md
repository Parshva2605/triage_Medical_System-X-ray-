# Medical Authentication & Triage System (X-Ray)

A full-stack medical triage and authentication system for doctors and patients, supporting user registration, login, symptom submission (with X-ray upload and AI analysis), prescription management, and secure video calls.

---

## Features

- **User Registration & Login**
  - Separate signup and login for patients and doctors
  - JWT authentication with HTTP-only cookies
  - Secure password hashing (bcrypt)
- **Patient Dashboard**
  - Submit symptoms and upload chest X-rays for AI analysis (make own CNN model for classify disease)
  - View personal prescriptions and video call schedules
- **Doctor Dashboard**
  - Review all patient submissions (including X-ray images and AI results — make own CNN model for classify disease)
  - Diagnose, create, and manage prescriptions
  - Initiate instant or scheduled video calls with patients
- **AI Chest Disease Detection**
  - Upload X-ray images for automated multi-disease detection using a deep learning model (VGG19-based or make own CNN model for classify disease)
  - Results are stored with each submission
- **Video Call System**
  - Secure, room-based WebRTC video calls between doctors and patients
  - Camera/microphone permission handling and device testing page
- **File Uploads**
  - Uploaded X-rays are stored in the `/uploads` folder
- **Project Workspace**
  - Collaborative project and chat system (see `project.html`)

---

## Project Structure

```
.
├── analyze_chest_diseases.py         # Python script for X-ray analysis (AI model, make own CNN model for classify disease)
├── final_chest_disease_model.h5      # Trained Keras model for chest disease detection (make own CNN model for classify disease)
├── check.py                          # Model training/resume script (for developers, make own CNN model for classify disease)
├── server.js                         # Node.js Express backend (API, WebSocket, file upload, AI integration)
├── package.json                      # Node.js dependencies and scripts
├── .env                              # Environment variables (PORT, JWT_SECRET, MONGODB_URI, etc.)
├── uploads/                          # Folder for storing uploaded X-ray images
├── index.html                        # Login page (patient/doctor)
├── signup.html                       # Signup page (patient/doctor)
├── patient-dashboard.html            # Patient dashboard (symptoms, prescriptions, calls)
├── doctor-dashboard.html             # Doctor dashboard (submissions, prescriptions, calls)
├── video-call.html                   # Video call UI (WebRTC)
├── camera-test.html                  # Camera/microphone test page
├── project.html                      # Project workspace and chat (collaboration)
└── README.md                         # This file
```

---

## File & Folder Descriptions

### Backend

- **server.js**
  - Express server with REST API endpoints for authentication, symptom submission, prescription management, and video call scheduling.
  - Handles file uploads (X-rays) using Multer; files are saved in `/uploads`.
  - Integrates with the AI model via `analyze_chest_diseases.py` for X-ray analysis (make own CNN model for classify disease).
  - WebSocket server for real-time video call signaling (room-based).
  - MongoDB models for patients, doctors, submissions, prescriptions, and video calls.

- **analyze_chest_diseases.py**
  - Python script that loads `final_chest_disease_model.h5` (make own CNN model for classify disease) and predicts diseases from a given X-ray image.
  - Called by the backend when a new X-ray is uploaded.
  - Outputs disease probabilities or detected conditions to stdout (captured by Node.js).

- **final_chest_disease_model.h5**
  - Pre-trained Keras model for multi-label chest disease detection (make own CNN model for classify disease).

- **check.py**
  - Script for training or resuming training of the chest disease model (make own CNN model for classify disease).
  - Not required for production use; for model development only.

- **uploads/**
  - Stores all uploaded X-ray images.
  - Images are saved with a timestamped filename.
  - Accessible via `/uploads/<filename>` for display in dashboards.

### Frontend

- **index.html** / **signup.html**
  - Patient and doctor login/signup forms.
  - Calls `/api/login` and `/api/patient|doctor/signup` endpoints.

- **patient-dashboard.html**
  - Patient home: submit symptoms, upload X-rays, view AI results (make own CNN model for classify disease), prescriptions, and video calls.

- **doctor-dashboard.html**
  - Doctor home: review all patient submissions, view X-rays and AI results (make own CNN model for classify disease), diagnose, create prescriptions, and start video calls.

- **video-call.html**
  - WebRTC-based video call UI for doctor-patient communication.
  - Handles camera/mic permissions, overlays, and call controls.

- **camera-test.html**
  - Standalone page for testing camera and microphone before joining a call.

- **project.html**
  - Project workspace and chat system (collaborative features).

---

## API Endpoints

- **Authentication**
  - `POST /api/patient/signup` — Register a new patient
  - `POST /api/doctor/signup` — Register a new doctor
  - `POST /api/login` — Login (patient/doctor)
  - `POST /api/logout` — Logout

- **Symptoms & X-ray**
  - `POST /api/submit-symptoms` — Submit symptoms and upload X-ray (patients only, JWT required)
    - X-ray image is saved to `/uploads`
    - AI analysis result (make own CNN model for classify disease) is stored in the submission
  - `GET /api/patient/symptom-submissions` — Get all submissions for the logged-in patient
  - `GET /api/doctor/symptom-submissions` — Get all submissions (doctors only)

- **Prescriptions**
  - `GET /api/patient/prescriptions` — Get all prescriptions for the logged-in patient
  - `POST /api/doctor/prescriptions` — Create a prescription (doctors only)
  - `GET /api/prescriptions/:id` — Get prescription details

- **Video Calls**
  - `POST /api/schedule-video-call` — Schedule a video call
  - `POST /api/instant-video-call` — Start an instant call
  - `GET /api/patient/scheduled-calls` — Get scheduled calls for patient
  - `GET /api/doctor/scheduled-calls` — Get scheduled calls for doctor

- **WebSocket**
  - Used for video call signaling (room join, offer, answer, ICE candidates)

---

## How X-ray Analysis Works

1. Patient submits symptoms and uploads an X-ray via the dashboard.
2. The image is saved to `/uploads`.
3. The backend calls `analyze_chest_diseases.py` with the image path (make own CNN model for classify disease).
4. The Python script loads `final_chest_disease_model.h5` (make own CNN model for classify disease) and predicts the presence of multiple chest diseases.
5. The result is saved in the submission and shown to both patient and doctor.

**Output Location:**
- Uploaded X-rays: `/uploads/`
- AI analysis results (make own CNN model for classify disease): Saved in MongoDB with each symptom submission (see `/api/patient/symptom-submissions`).

---

## Setup & Usage

### Prerequisites

- Node.js (v14+)
- MongoDB (local or Atlas)
- Python 3.7+ (with TensorFlow, Keras, pandas, numpy, etc. for AI analysis — make own CNN model for classify disease)
- (Optional) GPU for faster AI inference

### Installation

1. **Clone the repository**
2. **Install Node.js dependencies:**
   ```
   npm install
   ```
3. **Configure environment variables:**
   - Copy `.env.example` to `.env` and update as needed (see `.env` for required keys).
4. **Start MongoDB** (if local)
5. **Run the server:**
   ```
   npm start
   ```
   or for development:
   ```
   npm run dev
   ```
6. **Ensure Python and required packages are installed** for AI analysis (make own CNN model for classify disease).
7. **Access the app:**  
   Open [http://localhost:3002](http://localhost:3002) in your browser.

---

## Notes

- **Uploads Folder:**  
  All uploaded X-ray images are stored in the `/uploads` directory. This folder is created automatically if it does not exist.
- **AI Model Output:**  
  The output of the AI model (make own CNN model for classify disease) is not saved as a file, but as a string in the MongoDB database with each submission.
- **Security:**  
  Passwords are hashed. JWT tokens are stored in HTTP-only cookies. Do not expose `.env` or `/uploads` to the public internet without proper security.
- **Model Training:**  
  Use `check.py` (make own CNN model for classify disease) only if you want to retrain or resume training the AI model. For production, only `final_chest_disease_model.h5` and `analyze_chest_diseases.py` are needed.

---

## Essential Tips

- **Uploads folder** is required for storing X-ray images. Do not delete or move it.
- **Output of X-ray analysis** (make own CNN model for classify disease) is stored in the database, not as a file.
- **All API endpoints requiring authentication** expect a valid JWT cookie.
- **WebRTC video calls** require HTTPS in production for camera/mic access.
- **For AI analysis to work**, Python and all required packages must be installed on the server (make own CNN model for classify disease).

---

## License

This project is for educational and demonstration purposes. For production use, ensure compliance with medical data privacy laws and best security practices.