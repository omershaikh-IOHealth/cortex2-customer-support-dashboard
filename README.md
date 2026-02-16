# Cortex 2.0 Dashboard - Setup Guide

A real-time support center automation dashboard for monitoring tickets, SLA compliance, and escalations.

## 🎯 What You'll See

- **Real-time Dashboard** - Live metrics, critical SLA tickets, recent activity
- **Ticket Management** - Full ticket lifecycle with AI analysis and thread history
- **SLA Monitor** - Visual SLA consumption tracking with automatic escalations
- **Analytics** - Trends, priority distribution, and performance insights
- **System Logs** - Complete audit trail of all workflow executions
- **Configuration** - View SLA and escalation rules

## 📋 Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL Database** (accessible via VPN)
3. **Your Database Credentials**

## 🚀 Quick Start

### Step 1: Clone/Download the Project

The project structure:
```
cortex-dashboard/
├── backend/          # Express.js API
└── frontend/         # Next.js dashboard
```

### Step 2: Setup Backend API

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

**Edit `.env` with your database credentials:**
```env
DB_HOST=your_database_host
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
PORT=5000
```

**Start the backend:**
```bash
# Development mode (with auto-reload)
npm run dev

# OR production mode
npm start
```

You should see:
```
✅ Database connected successfully
🚀 Cortex Backend API running on http://localhost:5000
```

**Test it:** Open http://localhost:5000/api/health in your browser

### Step 3: Setup Frontend

Open a **NEW terminal** (keep backend running):

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.local.example .env.local
```

**Edit `.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

**Start the frontend:**
```bash
npm run dev
```

You should see:
```
  ▲ Next.js 14.1.0
  - Local:        http://localhost:3000
```

### Step 4: Access the Dashboard

**Open your browser:** http://localhost:3000

You'll be automatically redirected to the Dashboard!

## 🎨 Features Overview

### 1. Mission Control Dashboard (`/dashboard`)
- Active tickets count
- Critical SLA alerts
- High escalations tracking
- Average SLA consumption
- 24-hour ticket trends
- System status indicators
- Recent tickets and escalations feed

### 2. Tickets (`/tickets`)
- Complete ticket list with filtering
- Search by title, ID, or reporter
- Filter by priority, status, SLA
- Click any ticket to view full details
- Links to ClickUp for direct access

### 3. Ticket Details (`/tickets/[id]`)
- Full ticket information
- Reporter details
- SLA status with visual progress
- Complete activity thread/timeline
- All comments and field changes
- Escalation alerts history
- AI analysis summaries

### 4. SLA Monitor (`/sla`)
- Real-time SLA tracking
- Critical/At Risk/Warning breakdown
- Visual consumption indicators
- Sorted by urgency
- Auto-refreshes every 15 seconds

### 5. Escalations (`/escalations`)
- All escalation alerts
- Grouped by level (1-4)
- Notification recipients
- Acknowledgment status
- Links to related tickets

### 6. Analytics (`/analytics`)
- 30-day ticket trends chart
- Priority distribution pie chart
- Average SLA by priority
- Visual performance insights

### 7. System Logs (`/logs`)
- Complete workflow execution logs
- Success/failure tracking
- Error messages
- Detailed execution metadata

### 8. Configuration (`/config`)
- SLA configurations per priority
- Escalation thresholds and actions
- Notification routing rules

## 🔄 Auto-Refresh

Most views auto-refresh:
- Dashboard: Every 30 seconds
- SLA Monitor: Every 15 seconds
- Tickets: Every 30 seconds

## 🎨 Design Features

- **Dark mode** mission-control aesthetic
- **Real-time updates** with React Query
- **Color-coded** priorities and SLA status
- **Responsive** design for all screen sizes
- **Professional** data visualization
- **Fast** performance with optimized queries

## 🛠️ Troubleshooting

### Backend won't start

**Problem:** `Database connection failed`

**Solution:**
1. Make sure you're connected to VPN
2. Verify database credentials in `.env`
3. Test database connection manually

**Problem:** `Port 5000 already in use`

**Solution:**
```bash
# Change PORT in backend/.env to another port (e.g., 5001)
PORT=5001

# Update frontend/.env.local to match
NEXT_PUBLIC_API_URL=http://localhost:5001
```

### Frontend shows "No data"

**Problem:** API not connecting

**Solution:**
1. Verify backend is running (check http://localhost:5000/api/health)
2. Check NEXT_PUBLIC_API_URL in frontend/.env.local
3. Open browser console (F12) to see error messages

### Database connection issues

**Problem:** Connection timeout

**Solution:**
1. Ensure VPN is connected
2. Check firewall settings
3. Verify database host is reachable: `ping your_db_host`

## 📊 Database Schema

The system uses these main tables:
- `test.tickets` - All support tickets
- `test.threads` - Ticket activity/comments
- `test.sla_alerts` - Escalation notifications
- `test.pocs` - Points of contact
- `test.sla_configs` - SLA rules
- `test.escalation_configs` - Escalation thresholds
- `test.processing_logs` - Workflow logs

## 🔐 Security Notes

- Database credentials stored in `.env` files (never commit these!)
- Frontend API calls go through backend (no direct DB access)
- VPN required for database access
- All connections are HTTP (use HTTPS in production)

## 📝 Development Tips

### Adding a new API endpoint

1. Add route in `backend/server.js`
2. Add function in `frontend/lib/api.js`
3. Use in components with `useQuery`

### Customizing colors

Edit `frontend/tailwind.config.js`:
```js
colors: {
  'cortex-accent': '#your-color',
}
```

### Changing auto-refresh intervals

In any page component:
```js
refetchInterval: 30000, // milliseconds
```

## 🚀 Production Deployment

### Backend
```bash
# Use PM2 or similar
npm install -g pm2
pm2 start server.js --name cortex-backend

# Or use Docker
docker build -t cortex-backend .
docker run -p 5000:5000 cortex-backend
```

### Frontend
```bash
# Build production bundle
npm run build

# Start production server
npm start

# Or deploy to Vercel/Netlify
```

## 📞 Support

If you encounter issues:
1. Check both terminal windows for errors
2. Verify VPN connection
3. Test backend health endpoint
4. Check browser console (F12)

## 🎯 Next Steps

Once running, you can:
- Monitor real-time ticket flow
- Track SLA compliance
- Review escalation patterns
- Analyze support trends
- Export data from logs

---

**Built with:** Next.js, React Query, Express.js, PostgreSQL, Tailwind CSS

**License:** Internal Use Only
