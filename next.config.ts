const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=*, geolocation=*',
          },
        ],
      },
    ]
  },
}

export default nextConfig