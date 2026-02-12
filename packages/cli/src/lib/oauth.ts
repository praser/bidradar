import { createServer } from 'node:http'
import open from 'open'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? ''
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

interface OAuthResult {
  code: string
  redirectUri: string
}

export function startOAuthFlow(): Promise<OAuthResult> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(
          `<html><body><h1>Authentication failed</h1><p>${error}</p></body></html>`,
        )
        server.close()
        reject(new Error(`OAuth error: ${error}`))
        return
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(
          '<html><body><h1>Authentication successful!</h1><p>You can close this tab.</p></body></html>',
        )
        const address = server.address()
        const port =
          address && typeof address !== 'string' ? address.port : 0
        server.close()
        resolve({
          code,
          redirectUri: `http://localhost:${String(port)}`,
        })
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(
          '<html><body><h1>Missing authorization code</h1></body></html>',
        )
      }
    })

    server.listen(0, 'localhost', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to start OAuth server'))
        return
      }

      const redirectUri = `http://localhost:${String(address.port)}`
      const authUrl = new URL(GOOGLE_AUTH_URL)
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', 'openid email profile')
      authUrl.searchParams.set('access_type', 'offline')

      open(authUrl.toString())
    })

    setTimeout(() => {
      server.close()
      reject(new Error('OAuth flow timed out after 120 seconds'))
    }, 120_000)
  })
}
