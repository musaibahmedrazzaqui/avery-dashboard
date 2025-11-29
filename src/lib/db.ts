import { Pool, QueryResult } from 'pg';

let pool: Pool | null = null;

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    try {
      // Clean the connection string - remove quotes if present
      let connectionString = process.env.DATABASE_URL.trim();
      if ((connectionString.startsWith('"') && connectionString.endsWith('"')) ||
          (connectionString.startsWith("'") && connectionString.endsWith("'"))) {
        connectionString = connectionString.slice(1, -1);
      }
      
      console.log('🔌 Connecting to database...');
      console.log('📋 Database host:', connectionString.split('@')[1]?.split(':')[0] || 'unknown');
      
      pool = new Pool({
        connectionString: connectionString,
        // Force SSL for RDS connections, but don't reject self-signed certificates
        ssl: process.env.NODE_ENV === 'production' || connectionString.includes('rds.amazonaws.com') ? {
          rejectUnauthorized: false,
        } : false,
        // Add connection timeout and retry settings
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
      });
      
      // Handle pool errors
      pool.on('error', (err) => {
        console.error('Unexpected database pool error:', err);
      });
      
      // Test connection
      pool.query('SELECT NOW()').then(() => {
        console.log('✅ Database connection successful');
      }).catch((err) => {
        console.error('❌ Database connection test failed:', err.message);
      });
    } catch (error: any) {
      console.error('Failed to create database pool:', error.message);
      return null;
    }
  }
  return pool;
}

// Initialize database schema
export async function initializeSchema() {
  const pool = getPool();
  if (!pool) {
    console.warn('⚠️  Database not configured, skipping schema initialization');
    return;
  }

  let client;
  try {
    client = await pool.connect();
    // Create schema if it doesn't exist
    await client.query('CREATE SCHEMA IF NOT EXISTS dashboard');
    
    // Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS dashboard.orders (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(255) UNIQUE NOT NULL,
        store_type VARCHAR(50) NOT NULL,
        store_name VARCHAR(255) NOT NULL,
        order_number VARCHAR(255),
        total_price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP NOT NULL,
        fulfillment_status VARCHAR(50),
        financial_status VARCHAR(50),
        order_status VARCHAR(50),
        buyer_username VARCHAR(255),
        buyer_email VARCHAR(255),
        shipping_address JSONB,
        line_items JSONB NOT NULL,
        raw_data JSONB,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_date DATE GENERATED ALWAYS AS (created_at::date) STORED
      )
    `);

    // Create products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS dashboard.products (
        id SERIAL PRIMARY KEY,
        product_id VARCHAR(255) NOT NULL,
        store_type VARCHAR(50) NOT NULL,
        store_name VARCHAR(255) NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        product_type VARCHAR(255),
        vendor VARCHAR(255),
        tags TEXT[],
        variants JSONB NOT NULL,
        cost DECIMAL(10, 2),
        raw_data JSONB,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(product_id, store_type, store_name)
      )
    `);
    
    // Add cost column if it doesn't exist (for existing databases)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'dashboard' 
          AND table_name = 'products' 
          AND column_name = 'cost'
        ) THEN
          ALTER TABLE dashboard.products ADD COLUMN cost DECIMAL(10, 2);
        END IF;
      END $$;
    `);

    // Create customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS dashboard.customers (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(255) NOT NULL,
        store_type VARCHAR(50) NOT NULL,
        store_name VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        email VARCHAR(255),
        orders_count INTEGER DEFAULT 0,
        total_spent DECIMAL(10, 2) DEFAULT 0,
        tags TEXT[],
        addresses JSONB,
        raw_data JSONB,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(customer_id, store_type, store_name)
      )
    `);

    // Create indexes for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_store ON dashboard.orders(store_type, store_name);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON dashboard.orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_created_date ON dashboard.orders(created_date);
      CREATE INDEX IF NOT EXISTS idx_products_store ON dashboard.products(store_type, store_name);
      CREATE INDEX IF NOT EXISTS idx_customers_store ON dashboard.customers(store_type, store_name);
      CREATE INDEX IF NOT EXISTS idx_customers_email ON dashboard.customers(email);
    `);

    console.log('✅ Database schema initialized successfully');
  } catch (error: any) {
    console.error('❌ Error initializing schema:', error.message || error);
    // Don't throw - allow app to continue without database
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.warn('⚠️  Database connection failed. Please check DATABASE_URL in environment variables.');
    }
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not configured. Please set DATABASE_URL environment variable.');
  }
  return pool.query(text, params);
}

export async function getClient() {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not configured. Please set DATABASE_URL environment variable.');
  }
  return await pool.connect();
}

export function isDatabaseAvailable(): boolean {
  return getPool() !== null && !!process.env.DATABASE_URL;
}

export default getPool();

