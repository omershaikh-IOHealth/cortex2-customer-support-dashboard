# CORTEX 2.0 - QUICK START

## ⚡ Fast Setup (3 Steps)

### 1️⃣ Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run dev
```

### 2️⃣ Frontend Setup (New Terminal)
```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local if backend isn't on port 5000
npm run dev
```

### 3️⃣ Open Browser
```
http://localhost:3000
```

## ✅ Verify Everything Works

1. Backend running → http://localhost:5000/api/health
2. Frontend running → http://localhost:3000
3. Dashboard loads with data

## 🔧 Configuration Files

**Backend (.env)**
```
DB_HOST=your_db_host
DB_PORT=5432
DB_NAME=your_database
DB_USER=your_user
DB_PASSWORD=your_password
PORT=5000
```

**Frontend (.env.local)**
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## 📱 Access Points

- Dashboard: http://localhost:3000/dashboard
- Tickets: http://localhost:3000/tickets
- SLA Monitor: http://localhost:3000/sla
- Analytics: http://localhost:3000/analytics
- Logs: http://localhost:3000/logs

## 🐛 Common Issues

**Database connection failed**
- Ensure VPN is connected
- Check .env credentials

**Port already in use**
- Change PORT in backend/.env
- Update NEXT_PUBLIC_API_URL in frontend/.env.local

**No data showing**
- Verify backend is running
- Check browser console (F12)
- Ensure company_code='medgulf' has data in database

## 🎯 What You'll See

✅ Real-time ticket dashboard
✅ SLA consumption tracking
✅ Escalation alerts
✅ Complete ticket history
✅ Analytics and trends
✅ System logs

---

**Need help?** See README.md for detailed documentation
