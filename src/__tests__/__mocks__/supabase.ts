import { jest } from '@jest/globals';

// Mock Supabase client for testing
export const createMockSupabaseClient = () => {
  const mockChannel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };

  const mockRealtime = {
    channel: jest.fn().mockReturnValue(mockChannel),
    removeChannel: jest.fn(),
    removeAllChannels: jest.fn(),
    getChannels: jest.fn().mockReturnValue([]),
  };

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    containedBy: jest.fn().mockReturnThis(),
    rangeGt: jest.fn().mockReturnThis(),
    rangeGte: jest.fn().mockReturnThis(),
    rangeLt: jest.fn().mockReturnThis(),
    rangeLte: jest.fn().mockReturnThis(),
    rangeAdjacent: jest.fn().mockReturnThis(),
    overlaps: jest.fn().mockReturnThis(),
    textSearch: jest.fn().mockReturnThis(),
    match: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    abortSignal: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    csv: jest.fn().mockReturnThis(),
    geojson: jest.fn().mockReturnThis(),
    explain: jest.fn().mockReturnThis(),
    rollback: jest.fn().mockReturnThis(),
    returns: jest.fn().mockReturnThis(),
  };

  const mockTable = {
    ...mockQueryBuilder,
    from: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  const mockAuth = {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signInWithOAuth: jest.fn(),
    signOut: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    updateUser: jest.fn(),
    setSession: jest.fn(),
    refreshSession: jest.fn(),
    getSession: jest.fn(),
    getUser: jest.fn(),
    onAuthStateChange: jest.fn(),
    admin: {
      listUsers: jest.fn(),
      createUser: jest.fn(),
      deleteUser: jest.fn(),
      updateUserById: jest.fn(),
      inviteUserByEmail: jest.fn(),
    },
  };

  const mockStorage = {
    from: jest.fn().mockReturnValue({
      upload: jest.fn(),
      download: jest.fn(),
      list: jest.fn(),
      remove: jest.fn(),
      createSignedUrl: jest.fn(),
      createSignedUrls: jest.fn(),
      getPublicUrl: jest.fn(),
      move: jest.fn(),
      copy: jest.fn(),
    }),
    createBucket: jest.fn(),
    getBucket: jest.fn(),
    listBuckets: jest.fn(),
    updateBucket: jest.fn(),
    deleteBucket: jest.fn(),
    emptyBucket: jest.fn(),
  };

  const mockFunctions = {
    invoke: jest.fn(),
  };

  const mockClient = {
    from: jest.fn().mockReturnValue(mockTable),
    auth: mockAuth,
    storage: mockStorage,
    functions: mockFunctions,
    realtime: mockRealtime,
    channel: jest.fn().mockReturnValue(mockChannel),
    removeChannel: jest.fn(),
    removeAllChannels: jest.fn(),
    getChannels: jest.fn().mockReturnValue([]),
    rpc: jest.fn(),
  };

  return mockClient;
};

// Default mock client instance
export const mockSupabaseClient = createMockSupabaseClient();

// Mock the createClient function
export const createClient = jest.fn().mockReturnValue(mockSupabaseClient);

// Mock response helpers
export const createMockResponse = <T>(data: T, error: unknown = null) => ({
  data,
  error,
  status: error ? 400 : 200,
  statusText: error ? 'Bad Request' : 'OK',
});

export const createMockError = (message: string, code?: string) => ({
  message,
  code,
  details: null,
  hint: null,
});

// Mock realtime event helpers
export const createMockRealtimeEvent = (eventType: string, payload: unknown) => ({
  eventType,
  new: eventType === 'INSERT' || eventType === 'UPDATE' ? payload : null,
  old: eventType === 'DELETE' || eventType === 'UPDATE' ? payload : null,
  errors: null,
});

// Test utilities for Supabase mocks
export const supabaseTestUtils = {
  // Reset all mocks
  resetMocks: () => {
    jest.clearAllMocks();
  },

  // Mock successful response
  mockSuccess: <T>(data: T) => {
    mockSupabaseClient.from().select.mockResolvedValueOnce(createMockResponse(data));
    return data;
  },

  // Mock error response
  mockError: (message: string, code?: string) => {
    const error = createMockError(message, code);
    mockSupabaseClient.from().select.mockResolvedValueOnce(createMockResponse(null, error));
    return error;
  },

  // Mock realtime subscription
  mockRealtimeSubscription: (events: Array<{ eventType: string; payload: unknown }>) => {
    const mockChannel = mockSupabaseClient.channel();
    
    // Simulate subscription
    mockChannel.on.mockImplementation((event, callback) => {
      // Simulate events after subscription
      setTimeout(() => {
        events.forEach(({ eventType, payload }) => {
          callback(createMockRealtimeEvent(eventType, payload));
        });
      }, 0);
      return mockChannel;
    });

    return mockChannel;
  },

  // Mock auth state
  mockAuthState: (user: unknown = null, session: unknown = null) => {
    mockSupabaseClient.auth.getUser.mockResolvedValue(createMockResponse({ user }));
    mockSupabaseClient.auth.getSession.mockResolvedValue(createMockResponse({ session }));
  },

  // Mock Edge Function call
  mockEdgeFunction: (functionName: string, response: unknown, error: unknown = null) => {
    mockSupabaseClient.functions.invoke.mockImplementation((name, options) => {
      if (name === functionName) {
        return Promise.resolve(createMockResponse(response, error));
      }
      return Promise.resolve(createMockResponse(null, createMockError('Function not found')));
    });
  },
};