# AniSync

A web application that syncs your Crunchyroll watch history with AniList.

## Configuration Setup

### Backend Configuration (.env file)

Create a `.env` file in the `back` directory with the following variables:

```env
# MongoDB Configuration
MONGO_URI=your_mongodb_connection_string

# JWT Configuration
JWT_SECRET_KEY=your_jwt_secret_key

# PayPal Configuration (for payments)
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret

# API Keys (these are already set but you can modify if needed)
ANILIST_CLIENT_ID=25863
ANILIST_CLIENT_SECRET=KlLaYr99pqnLyWkRGrb72scBMe9NUE4kR
ANILIST_REDIRECT_URI=http://localhost:5173
```

### Frontend Configuration (.env file)

Create a `.env` file in the `front` directory with the following variables:

```env
VITE_API_URL=http://localhost:4001
VITE_PAYPAL_CLIENT_ID=your_paypal_client_id
VITE_ANILIST_CLIENT_ID=25863
```

## Getting API Keys

1. **MongoDB:**
   - Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
   - Create a new cluster
   - Get your connection string from the "Connect" button
   - Replace `your_mongodb_connection_string` with your actual connection string

2. **JWT Secret Key:**
   - Generate a secure random string for JWT_SECRET_KEY
   - You can use a command like `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

3. **PayPal:**
   - Go to https://developer.paypal.com/
   - Create a developer account
   - Create a new app in the Developer Dashboard
   - Get your client ID and secret
   - Replace `your_paypal_client_id` and `your_paypal_client_secret` with your actual credentials

4. **AniList:**
   - The default AniList client ID and secret are already configured
   - If you need to create your own:
     1. Go to https://anilist.co/settings/developer
     2. Create a new client
     3. Set the redirect URI to `http://localhost:5173`
     4. Replace the client ID and secret in both .env files

## Setup Instructions

1. Install dependencies:
   ```bash
   # Backend
   cd back
   npm install
   pip install -r requirements.txt

   # Frontend
   cd ../front
   npm install
   ```

2. Set up your environment files as described above

3. Start the services:
   ```bash
   # Backend API (from the back directory)
   python run.py

   # Puppeteer service (from the back directory)
   node server.js

   # Frontend (from the front directory)
   npm run dev
   ```

4. Access the application at http://localhost:5173

## Important Notes

- The backend runs on port 4001
- The Puppeteer service runs on port 4000
- The frontend runs on port 5173
- Make sure all these ports are available
- Chrome browser is required for the Puppeteer service to work
- MongoDB must be running and accessible
- All API keys and secrets should be kept secure and never committed to version control