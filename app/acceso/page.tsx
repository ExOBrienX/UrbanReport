'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function AccesoPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async () => {
    await signIn('credentials', {
      email,
      password,
      callbackUrl: '/admin'
    })
  }

  return (
    <div>
      <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
      <input placeholder="Password" type="password" onChange={e => setPassword(e.target.value)} />
      <button onClick={handleLogin}>Entrar</button>
    </div>
  )
}