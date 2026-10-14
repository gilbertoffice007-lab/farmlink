import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api, apiError } from '../lib/api'
import { FieldError } from '../components/common/ui'

const schema = z.object({
  farm_name: z.string().min(2, 'Farm name is required.'),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional()
})

export default function SellerOnboarding() {
  const nav = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })
  const mut = useMutation({
    mutationFn: async (v: z.infer<typeof schema>) => (await api.patch('/sellers/me', v)).data,
    onSuccess: async () => {
      try { await api.post('/sellers/verification-request') } catch {}
      toast.success('Farm profile saved!')
      nav('/seller')
    },
    onError: (e: any) => {
      // PATCH 404 means no profile yet — create via same endpoint works (upsert). If it truly 404s, surface message.
      toast.error(apiError(e))
    }
  })
  // First-time sellers have no profile; the backend upserts on PATCH, so one step suffices.
  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold text-forest">Set up your farm</h1>
      <p className="text-muted text-sm mt-1">Buyers see your farm name, location and verification status.</p>
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="card p-6 mt-5 space-y-4">
        <div>
          <label className="label" htmlFor="farm">Farm / FPO name</label>
          <input id="farm" className="input" {...register('farm_name')} />
          <FieldError msg={errors.farm_name?.message} />
        </div>
        <div>
          <label className="label" htmlFor="desc">About your farm</label>
          <textarea id="desc" className="input" rows={3} {...register('description')} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label" htmlFor="city">City</label><input id="city" className="input" {...register('city')} /></div>
          <div><label className="label" htmlFor="state">State</label><input id="state" className="input" {...register('state')} /></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label" htmlFor="addr">Address</label><input id="addr" className="input" {...register('address')} /></div>
          <div><label className="label" htmlFor="pin">Postal code</label><input id="pin" className="input" {...register('postal_code')} /></div>
        </div>
        <button className="btn-primary w-full" disabled={mut.isPending}>{mut.isPending ? 'Saving…' : 'Save & continue'}</button>
      </form>
    </div>
  )
}
