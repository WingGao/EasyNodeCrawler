jest.mock('brotli', () => ({
  compress(e) {
    return '';
  },
}));
// console.log('mock');
