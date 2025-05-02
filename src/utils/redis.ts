import Redis from 'ioredis';

export const redis = new Redis({
  port: 6379,
  host: 'current-ocelot-17582.upstash.io',
  username: 'default',
  password: 'AUSuAAIjcDFjZmFiNGQ0Njk1MTE0Y2I5YTJhMTBiNWYzNTdkYzM1NnAxMA',
  tls: {}
}); 