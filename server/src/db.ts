import sql from 'mssql';

const config: sql.config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'sneakychat-db',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'password',
  options: {
    encrypt: true,
    trustServerCertificate: process.env.NODE_ENV !== 'production',
  },
};

let pool: sql.ConnectionPool | null = null;

export async function initializeDatabase(): Promise<void> {
  try {
    console.log('🔧 Connecting to:', config.server);
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('✅ Database connected');

    // Create blocked_users table
    await pool.request().query(`
      IF NOT EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'blocked_users')
      BEGIN
        CREATE TABLE blocked_users (
          user_id NVARCHAR(255) PRIMARY KEY,
          reason NVARCHAR(500),
          suspended_until BIGINT NOT NULL,
          created_at BIGINT NOT NULL,
          created_by NVARCHAR(255),
          is_permanent BIT NOT NULL DEFAULT 0,
          ip_address NVARCHAR(45),
          report_id NVARCHAR(255)
        )
      END
    `);
    await pool.request().query(`
      IF COL_LENGTH('blocked_users', 'report_id') IS NULL
        ALTER TABLE blocked_users ADD report_id NVARCHAR(255)
    `);
    console.log('📦 blocked_users table ready');

    // Create admins table
    await pool.request().query(`
      IF NOT EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'admins')
      BEGIN
        CREATE TABLE admins (
          user_id NVARCHAR(255) PRIMARY KEY,
          role NVARCHAR(50) NOT NULL DEFAULT 'moderator',
          created_at BIGINT NOT NULL,
          created_by NVARCHAR(255),
          is_active BIT NOT NULL DEFAULT 1
        )
      END
    `);
    console.log('📦 admins table ready');

    // Create admin_credentials table
    await pool.request().query(`
      IF NOT EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'admin_credentials')
      BEGIN
        CREATE TABLE admin_credentials (
          id INT PRIMARY KEY IDENTITY(1,1),
          admin_user_id NVARCHAR(255) NOT NULL UNIQUE,
          username NVARCHAR(255) NOT NULL UNIQUE,
          password_hash NVARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL,
          last_login BIGINT,
          is_active BIT NOT NULL DEFAULT 1,
          FOREIGN KEY (admin_user_id) REFERENCES admins(user_id)
        )
      END
    `);
    console.log('📦 admin_credentials table ready');

    // Create reports table
    await pool.request().query(`
      IF NOT EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'reports')
      BEGIN
        CREATE TABLE reports (
          id INT PRIMARY KEY IDENTITY(1,1),
          report_id NVARCHAR(255) NOT NULL UNIQUE,
          reporter_id NVARCHAR(255) NOT NULL,
          reported_user_id NVARCHAR(255) NOT NULL,
          chat_id NVARCHAR(255) NOT NULL,
          message_id NVARCHAR(255) NOT NULL,
          message_text NVARCHAR(MAX),
          reason NVARCHAR(500) NOT NULL,
          message_meta NVARCHAR(MAX),
          conversation_context NVARCHAR(MAX),
          reported_at BIGINT NOT NULL,
          reviewed_at BIGINT,
          status NVARCHAR(50) NOT NULL DEFAULT 'pending',
          reviewed_by NVARCHAR(255)
        )
      END
    `);
    console.log('📦 reports table ready');

    // Create appeals table
    await pool.request().query(`
      IF NOT EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'appeals')
      BEGIN
        CREATE TABLE appeals (
          id INT PRIMARY KEY IDENTITY(1,1),
          appeal_id NVARCHAR(255) NOT NULL UNIQUE,
          user_id NVARCHAR(255) NOT NULL,
          report_id NVARCHAR(255),
          reason NVARCHAR(500) NOT NULL,
          message NVARCHAR(MAX),
          created_at BIGINT NOT NULL,
          status NVARCHAR(50) NOT NULL DEFAULT 'pending',
          reviewed_by NVARCHAR(255),
          reviewed_at BIGINT
        )
      END
    `);
    await pool.request().query(`
      IF COL_LENGTH('appeals', 'report_id') IS NULL
        ALTER TABLE appeals ADD report_id NVARCHAR(255)
    `);
    console.log('📦 appeals table ready');
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    throw err;
  }
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.close();
    console.log('🔌 Database disconnected');
  }
}
