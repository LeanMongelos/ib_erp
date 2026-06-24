'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import './login.css'

const loginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(4, 'Mínimo 4 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

const AUTH_TIMEOUT_MS = 20_000

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms)
    }),
  ])
}

export default function LoginPage() {
  const router = useRouter()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginForm) {
    setLoading(true)
    try {
      const statusRes = await withTimeout(
        fetch('/api/auth/login-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email }),
        }),
        AUTH_TIMEOUT_MS,
        'timeout',
      )
      if (!statusRes.ok) {
        toast.error('El servidor no respondió. Probá recargar la página o ejecutá npm run dev:up.')
        return
      }
      const status = await statusRes.json().catch(() => ({}))

      if (status.locked) {
        const msg =
          status.reason === 'ip'
            ? `Demasiados intentos desde esta red. Esperá ${status.retryAfterMinutes} min.`
            : `Cuenta bloqueada por ${status.maxAttempts} intentos fallidos. Reintentá en ${status.retryAfterMinutes} min.`
        toast.error(msg)
        return
      }

      const result = await withTimeout(
        signIn('credentials', {
          email: data.email,
          password: data.password,
          redirect: false,
        }),
        AUTH_TIMEOUT_MS,
        'timeout',
      )

      if (!result?.ok) {
        if (result?.url?.includes('csrf=true')) {
          toast.error('Sesión de login expirada. Recargá la página e intentá de nuevo.')
          return
        }
        const after = await fetch('/api/auth/login-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email }),
        }).then((r) => r.json().catch(() => ({})))

        if (after.locked) {
          toast.error(
            `Cuenta bloqueada por ${after.maxAttempts ?? 5} intentos fallidos. Reintentá en ${after.retryAfterMinutes} min.`,
          )
        } else if (typeof after.attemptsRemaining === 'number' && after.attemptsRemaining > 0) {
          toast.error(
            `Credenciales incorrectas. Te quedan ${after.attemptsRemaining} intento(s) antes del bloqueo.`,
          )
        } else {
          toast.error('Credenciales incorrectas. Verificá tu email y contraseña.')
        }
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (e) {
      const msg = e instanceof Error && e.message === 'timeout'
        ? 'El servidor tardó demasiado. Ejecutá npm run dev:up en la terminal e intentá de nuevo.'
        : 'Error al conectar con el servidor.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page min-h-screen flex flex-col items-center justify-center">
      <div className="login-ambient" aria-hidden>
        <div className="login-grid" />
        <div className="login-rays" />
        <div className="login-vignette" />
        <div className="login-scan" />
        <svg className="login-ecg login-ecg--back" viewBox="0 0 1200 80" preserveAspectRatio="none">
          <path
            className="login-ecg-path"
            d="M0,40 H180 L200,40 L218,40 L232,8 L248,72 L262,40 L282,40 H1200"
            pathLength="1"
          />
        </svg>
        <svg className="login-ecg login-ecg--front" viewBox="0 0 1200 80" preserveAspectRatio="none">
          <path
            className="login-ecg-path login-ecg-path--bright"
            d="M0,40 H420 L438,40 L452,8 L468,72 L482,40 L500,40 H1200"
            pathLength="1"
          />
        </svg>
        <div className="login-streak login-streak--1" />
        <div className="login-streak login-streak--2" />
        <div className="login-streak login-streak--3" />
        <div className="login-orb login-orb--top" />
        <div className="login-orb login-orb--bottom" />
        <div className="login-orb login-orb--side" />
      </div>

      <div className="login-content flex flex-col items-center">
      {/* Logo */}
      <div className="login-logo-wrap">
        <Image
          src="/logo.png"
          alt="Ingeniería Biomédica"
          width={200}
          height={200}
          priority
          className="login-logo object-contain"
        />
      </div>

      {/* Títulos */}
      <div className="login-heading text-center mt-6 mb-9">
        <h1 className="text-white text-[25px] font-extrabold tracking-tight">
          Sistema de Gestión
        </h1>
        <p className="text-[#9aa1ab] text-[14px] font-medium mt-1.5 tracking-wide">
          Formosa
        </p>
      </div>

      {/* Formulario */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="login-form w-[380px] flex flex-col gap-4"
        noValidate
      >
        <div className="login-corners" aria-hidden>
          <span /><span /><span /><span />
        </div>
        {/* Email */}
        <div className="login-field">
          <label className="block text-[#8b929c] text-[11.5px] font-semibold mb-1.5 tracking-wide">
            Usuario
          </label>
          <div className="login-input-wrap flex items-center gap-2.5 bg-[#121212] border border-[#272727] rounded-[9px] px-3">
            <User size={17} strokeWidth={1.8} className="text-[#6b7280] flex-shrink-0" />
            <input
              {...register('email')}
              type="email"
              placeholder="tu@email.com"
              className="login-input flex-1 bg-transparent border-none outline-none text-white text-[14px] font-sans py-3"
              autoComplete="email"
            />
          </div>
          {errors.email && (
            <p className="text-red-400 text-[11px] mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Contraseña */}
        <div className="login-field">
          <label className="block text-[#8b929c] text-[11.5px] font-semibold mb-1.5 tracking-wide">
            Contraseña
          </label>
          <div className="login-input-wrap flex items-center gap-2.5 bg-[#121212] border border-[#272727] rounded-[9px] px-3">
            <Lock size={17} strokeWidth={1.8} className="text-[#6b7280] flex-shrink-0" />
            <input
              {...register('password')}
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••••"
              className="login-input flex-1 bg-transparent border-none outline-none text-white text-[14px] font-sans py-3 tracking-widest placeholder:tracking-normal"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="text-[#6b7280] hover:text-[#9aa1ab] transition-colors"
              tabIndex={-1}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-400 text-[11px] mt-1">{errors.password.message}</p>
          )}
        </div>

        {/* Botón */}
        <button
          type="submit"
          disabled={loading}
          className="login-btn mt-1.5 w-full flex items-center justify-center gap-2 text-white font-extrabold text-[14.5px] border-none rounded-[9px] py-3.5 cursor-pointer tracking-wide disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg,#F0820A,#E8650A)',
            boxShadow: '0 6px 18px rgba(232,101,10,.4)',
          }}
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>

        <a
          href="#"
          className="login-forgot text-center text-[#8b929c] text-[12.5px] font-medium hover:text-[#9aa1ab] transition-colors"
        >
          ¿Olvidaste tu contraseña?
        </a>
      </form>
      </div>

      {/* Footer */}
      <a
        href="https://lmdigitalsolutions.com.ar/"
        target="_blank"
        rel="noopener noreferrer"
        className="login-footer absolute bottom-6 z-[1] flex items-center gap-3 hover:opacity-90 transition-opacity"
      >
        <Image
          src="/1.png"
          alt="LM Digital Solutions"
          width={80}
          height={40}
          className="object-contain"
        />
        <span className="text-[#6b7280] text-[12px] font-medium">
          Desarrollado por{' '}
          <span className="text-[#7dd3fc] font-bold">LM Digital Solutions</span>
        </span>
      </a>
    </div>
  )
}
