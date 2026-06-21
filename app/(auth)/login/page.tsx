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

const loginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(4, 'Mínimo 4 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

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
      const statusRes = await fetch('/api/auth/login-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      })
      const status = await statusRes.json().catch(() => ({}))

      if (status.locked) {
        const msg =
          status.reason === 'ip'
            ? `Demasiados intentos desde esta red. Esperá ${status.retryAfterMinutes} min.`
            : `Cuenta bloqueada por ${status.maxAttempts} intentos fallidos. Reintentá en ${status.retryAfterMinutes} min.`
        toast.error(msg)
        return
      }

      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
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
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      toast.error('Error al conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative"
      style={{
        background: 'radial-gradient(900px 520px at 50% -8%, rgba(232,101,10,.26), rgba(232,101,10,0) 60%), radial-gradient(700px 500px at 50% 120%, rgba(245,184,0,.10), transparent 60%), #050505',
      }}
    >
      {/* Logo */}
      <Image
        src="/logo.png"
        alt="Ingeniería Biomédica"
        width={120}
        height={120}
        priority
        className="object-contain drop-shadow-[0_0_28px_rgba(232,101,10,0.55)]"
      />

      {/* Títulos */}
      <div className="text-center mt-6 mb-9">
        <h1 className="text-white text-[25px] font-extrabold tracking-tight">
          Sistema de Gestión
        </h1>
        <p className="text-[#9aa1ab] text-[14px] font-medium mt-1.5 tracking-wide">
          Ingeniería Biomédica · Formosa
        </p>
      </div>

      {/* Formulario */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-[380px] flex flex-col gap-4"
        noValidate
      >
        {/* Email */}
        <div>
          <label className="block text-[#8b929c] text-[11.5px] font-semibold mb-1.5 tracking-wide">
            Usuario
          </label>
          <div className="flex items-center gap-2.5 bg-[#121212] border border-[#272727] rounded-[9px] px-3 focus-within:border-[#E8650A] transition-colors">
            <User size={17} strokeWidth={1.8} className="text-[#6b7280] flex-shrink-0" />
            <input
              {...register('email')}
              type="email"
              placeholder="tu@email.com"
              className="flex-1 bg-transparent border-none outline-none text-white text-[14px] font-sans py-3"
              autoComplete="email"
            />
          </div>
          {errors.email && (
            <p className="text-red-400 text-[11px] mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Contraseña */}
        <div>
          <label className="block text-[#8b929c] text-[11.5px] font-semibold mb-1.5 tracking-wide">
            Contraseña
          </label>
          <div className="flex items-center gap-2.5 bg-[#121212] border border-[#272727] rounded-[9px] px-3 focus-within:border-[#E8650A] transition-colors">
            <Lock size={17} strokeWidth={1.8} className="text-[#6b7280] flex-shrink-0" />
            <input
              {...register('password')}
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••••"
              className="flex-1 bg-transparent border-none outline-none text-white text-[14px] font-sans py-3 tracking-widest placeholder:tracking-normal"
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
          className="mt-1.5 w-full flex items-center justify-center gap-2 text-white font-extrabold text-[14.5px] border-none rounded-[9px] py-3.5 cursor-pointer transition-all tracking-wide disabled:opacity-60"
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
          className="text-center text-[#8b929c] text-[12.5px] font-medium hover:text-[#9aa1ab] transition-colors"
        >
          ¿Olvidaste tu contraseña?
        </a>
      </form>

      {/* Footer */}
      <a
        href="https://lmdigitalsolutions.com.ar/"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-6 flex items-center gap-3 hover:opacity-90 transition-opacity"
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
