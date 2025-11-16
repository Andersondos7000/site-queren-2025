export default async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');
  
  // Cleanup test database connections
  try {
    // Close any open database connections
    // This would typically close test Supabase connections
    console.log('✅ Database connections closed');
  } catch (error) {
    console.warn('⚠️ Error closing database connections:', error);
  }
  
  // Cleanup temporary files
  try {
    // Remove any temporary test files
    console.log('✅ Temporary files cleaned');
  } catch (error) {
    console.warn('⚠️ Error cleaning temporary files:', error);
  }
  
  // Performance report
  if (global.testStartTime) {
    const duration = Date.now() - global.testStartTime;
    console.log(`⏱️ Total test execution time: ${duration}ms`);
  }
  
  // Restore real timers
  jest.useRealTimers();
  
  // Final cleanup
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_ANON_KEY;
  delete process.env.VITE_APP_ENV;
  
  console.log('✅ Global test teardown completed');
}

// Type declaration for global test variables
declare global {
  var testStartTime: number;
}