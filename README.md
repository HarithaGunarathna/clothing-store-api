# Clothing Store API

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat&logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?style=flat&logo=mysql&logoColor=white)
![TypeORM](https://img.shields.io/badge/TypeORM-0.3-FE0803?style=flat&logo=typeorm&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=flat&logo=jsonwebtokens&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=nodedotjs&logoColor=white)

A RESTful API backend for a clothing store platform built with [NestJS](https://nestjs.com/), TypeORM, and MySQL. Supports user registration, JWT authentication, and role-based access (buyer / seller / admin).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (TypeScript) |
| ORM | TypeORM 0.3 |
| Database | MySQL 8 |
| Auth | JWT (`@nestjs/jwt`) + bcryptjs |
| Config | `@nestjs/config` (.env) |

---

## Project Structure

```
src/
├── auth/               # Login, register, JWT guard
├── user/               # User entity, service, DTOs
│   ├── dto/            # CreateUserDTO, LoginDTO
│   └── model/          # user.entity.ts
├── common/
│   ├── database/       # TypeORM module setup
│   └── entity/         # TimedEntity, AuditableEntity base classes
├── config/             # database.config.ts
├── constants/          # role.enum.ts (Buyer | Seller | Admin)
├── roles/              # @Roles() decorator
├── app.module.ts
└── main.ts
db/
└── init.sql            # Database schema
```

---

## Prerequisites

- Node.js 18+
- MySQL 8 running locally (or remote)
- npm

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
APP_SECRET=your-jwt-secret-here
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=clothing_store
```

### 3. Initialize the database

```bash
mysql -u <username> -p clothing_store < db/init.sql
```

### 4. Run the application

```bash
# development
npm run start

# watch mode (recommended for development)
npm run start:dev

# production
npm run start:prod
```

The server starts on `http://localhost:3000` by default.

---

## API Endpoints

### Health Check

| Method | Path | Description |
|---|---|---|
| GET | `/` | Returns `Hello World!` |

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Register a new user |
| POST | `/auth/login` | No | Login and receive a JWT |
| GET | `/auth/all-users` | No | List all users |

#### POST `/auth/register`

Request body:

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "userName": "janedoe",
  "email": "jane@example.com",
  "password": "secret",
  "phoneNumber": "0771234567",
  "dob": "1995-06-15",
  "role": "buyer"
}
```

Response `201`:

```json
{
  "access_token": "<jwt>"
}
```

#### POST `/auth/login`

Request body:

```json
{
  "userName": "janedoe",
  "password": "secret"
}
```

Response `200`:

```json
{
  "access_token": "<jwt>"
}
```

#### Using the JWT

Include the token in the `Authorization` header for protected routes:

```
Authorization: Bearer <access_token>
```

---

## User Roles

| Role | Value |
|---|---|
| Buyer | `buyer` |
| Seller | `seller` |
| Admin | `admin` |

Roles are assigned at registration. A `@Roles()` decorator is available for future role-guard implementation.

---

## Database Schema

**Table: `users`**

| Column | Type | Notes |
|---|---|---|
| `id` | INT | Primary key, auto-increment |
| `first_name` | VARCHAR(100) | |
| `last_name` | VARCHAR(100) | |
| `user_name` | VARCHAR(255) | Unique |
| `email` | VARCHAR(255) | Unique |
| `phone_number` | VARCHAR(20) | Nullable |
| `dob` | DATE | Nullable |
| `is_active` | BOOLEAN | Default `true` |
| `role` | VARCHAR(50) | `buyer` / `seller` / `admin` |
| `password_hash` | VARCHAR(255) | bcrypt hash |
| `created_at` | TIMESTAMP | Auto-set on insert |
| `updated_at` | TIMESTAMP | Auto-updated |

Passwords are hashed with bcrypt (salt rounds: 10) automatically via a `@BeforeInsert()` entity hook.

---

## Testing

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# coverage report
npm run test:cov
```

---

## License

This project is [MIT licensed](LICENSE).
