# 🧪 API Testing Guide

Bu qo'llanma HR Platform API ni test qilish uchun.

---

## 📋 Test Workflow

### 1. Health Check

```bash
curl http://localhost:5000/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "HR Platform API is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "development"
}
```

---

### 2. Login (SUPER_ADMIN)

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'"$SEED_ADMIN_EMAIL"'",
    "password": "'"$SEED_ADMIN_PASSWORD"'"
  }' \
  -c cookies.txt
```

**Response:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "<SEED_ADMIN_EMAIL>",
      "role": "SUPER_ADMIN",
      "first_name": "Super",
      "last_name": "Admin"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Save the access token** for next requests!

---

### 3. Create Invite Link

```bash
TOKEN="your_access_token_here"

curl -X POST http://localhost:5000/api/v1/invites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Invite created successfully",
  "data": {
    "invite": {
      "id": "uuid",
      "token": "64-character-random-string",
      "invite_url": "http://localhost:5173/register?token=...",
      "expires_at": "2024-01-08T00:00:00.000Z"
    }
  }
}
```

---

### 4. Register New Admin

```bash
INVITE_TOKEN="token_from_step_3"

curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'$INVITE_TOKEN'",
    "email": "admin2@example.com",
    "password": "SecurePass123!",
    "firstName": "Admin",
    "lastName": "User"
  }'
```

---

### 5. Create Employee (ADMIN)

```bash
curl -X POST http://localhost:5000/api/v1/employees \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+998901234567",
    "address": "Tashkent, Uzbekistan",
    "birthDate": "1995-05-15",
    "experience": 3,
    "position": "Frontend Developer",
    "notes": "Yaxshi tajriba bor"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Employee created successfully",
  "data": {
    "employee": { ... },
    "application": {
      "id": "uuid",
      "status": "KELDI",
      "position": "Frontend Developer"
    }
  }
}
```

---

### 6. Get All Applications (Kanban Data)

```bash
curl http://localhost:5000/api/v1/applications \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "applications": {
      "KELDI": [
        {
          "id": "uuid",
          "status": "KELDI",
          "position": "Frontend Developer",
          "employee": {
            "first_name": "John",
            "last_name": "Doe",
            "age": 28
          }
        }
      ],
      "QOSHILDI": [],
      "SHARTNOMA": []
    }
  }
}
```

---

### 7. Update Application Status (HR)

```bash
APPLICATION_ID="uuid_from_step_6"

curl -X PATCH http://localhost:5000/api/v1/applications/$APPLICATION_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "QOSHILDI",
    "comment": "Interview passed successfully"
  }'
```

---

### 8. Get Application History

```bash
curl http://localhost:5000/api/v1/applications/$APPLICATION_ID/history \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔧 Postman Collection

Import quyidagi JSON ni Postman ga:

```json
{
  "info": {
    "name": "HR Platform API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:5000/api/v1"
    },
    {
      "key": "accessToken",
      "value": ""
    }
  ]
}
```

---

## 📊 Test Scenarios

### Scenario 1: Admin Workflow
1. Login as ADMIN
2. Create new employee
3. View employee list
4. Update employee info

### Scenario 2: HR Workflow
1. Login as HR
2. Get all applications (Kanban)
3. Move application: KELDI → QOSHILDI
4. Add notes to application
5. Assign application to self
6. View application history

### Scenario 3: SUPER_ADMIN Workflow
1. Login as SUPER_ADMIN
2. Create invite link
3. View all invites
4. Deactivate used invite

---

## ⚠️ Common Errors

### 401 Unauthorized
- Token muddati tugagan
- Token noto'g'ri
- Header'da Authorization yo'q

**Solution:** Login qayta qiling va yangi token oling

### 403 Forbidden
- Role yetarli emas
- Endpoint uchun ruxsat yo'q

**Solution:** To'g'ri role bilan login qiling

### 422 Validation Error
- Ma'lumotlar formati noto'g'ri
- Required fieldlar yo'q

**Solution:** Request body'ni tekshiring

---

## 🎯 Performance Testing

```bash
# Apache Bench
ab -n 1000 -c 10 http://localhost:5000/health

# Artillery
artillery quick --count 10 --num 100 http://localhost:5000/api/v1/applications
```

---

**Happy Testing! 🚀**
