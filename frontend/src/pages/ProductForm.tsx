import { useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { Mic } from 'lucide-react'
import { api, apiError } from '../lib/api'
import { queryClient } from '../lib/query-client'
import { parseListingDraft } from '../lib/voice-parser'
import { VoiceInput } from '../components/voice/VoiceInput'
import { FieldError } from '../components/common/ui'

const schema = z.object({
  name: z.string().min(2, 'Name is required.'),
  category_id: z.string().optional(),
  description: z.string().optional(),
  price: z.coerce.number().positive('Price must be positive.'),
  unit: z.string().default('kg'),
  available_quantity: z.coerce.number().min(0, 'Stock cannot be negative.'),
  minimum_order_quantity: z.coerce.number().positive().default(1),
  location: z.string().optional(),
  image_url: z.string().optional()
})

export default function ProductForm() {
  const { id } = useParams()
  const isEdit = !!id
  const nav = useNavigate()
  const location = useLocation()
  const voiceApplied = useRef(false)
  const { data: cats } = useQuery({ queryKey: ['cats'], queryFn: async () => (await api.get('/categories')).data })
  const { data: existing } = useQuery({
    queryKey: ['product', id], enabled: isEdit,
    queryFn: async () => (await api.get(`/products/${id}`)).data
  })
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema), values: existing ? {
      name: existing.name, category_id: existing.category_id ? String(existing.category_id) : '',
      description: existing.description || '', price: Number(existing.price), unit: existing.unit,
      available_quantity: Number(existing.available_quantity),
      minimum_order_quantity: Number(existing.minimum_order_quantity) || 1,
      location: existing.location || '', image_url: existing.image_url || ''
    } : { unit: 'kg', minimum_order_quantity: 1 } as any
  })
  useEffect(() => {
    if (isEdit || voiceApplied.current) return
    const draft = (location.state as any)?.voiceDraft
    if (!draft) return
    voiceApplied.current = true
    if (draft.name) setValue('name', draft.name)
    if (draft.quantity != null) setValue('available_quantity', draft.quantity)
    if (draft.unit) setValue('unit', draft.unit)
    if (draft.price != null) setValue('price', draft.price)
    if (draft.pickupLocation) setValue('location', draft.pickupLocation)
    toast.success('Voice details added. Review every field before publishing.')
  }, [isEdit, location.state, setValue])

  const applyVoice = (text: string) => {
    const draft = parseListingDraft(text)
    let applied = 0
    if (draft.name) { setValue('name', draft.name); applied += 1 }
    if (draft.quantity != null) { setValue('available_quantity', draft.quantity); applied += 1 }
    if (draft.unit) { setValue('unit', draft.unit); applied += 1 }
    if (draft.price != null) { setValue('price', draft.price); applied += 1 }
    if (draft.pickupLocation) { setValue('location', draft.pickupLocation); applied += 1 }
    toast(applied ? `${applied} field${applied === 1 ? '' : 's'} filled from your review. Complete the rest before publishing.` : 'No usable details were found. Fill the form manually or try again.')
  }

  const mut = useMutation({
    mutationFn: async (v: any) => {
      const payload = { ...v, category_id: v.category_id ? String(v.category_id) : null, image_url: v.image_url || null }
      return isEdit ? (await api.patch(`/products/${id}`, payload)).data : (await api.post('/products', payload)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mine'] })
      queryClient.invalidateQueries({ queryKey: ['seller-dash'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(isEdit ? 'Listing updated' : 'Listing published'); nav('/seller')
    },
    onError: (e: any) => toast.error(apiError(e))
  })

  const upload = async (f: File) => {
    const fd = new FormData()
    fd.append('file', f)
    try {
      const { data } = await api.post('/uploads/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const apiOrigin = new URL(api.defaults.baseURL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1', window.location.origin).origin
      const full = `${apiOrigin}${data.image_url}`;
      setValue('image_url', full, { shouldDirty: true, shouldValidate: true })
      toast.success('Image uploaded')
    } catch (e: any) { toast.error(apiError(e)) }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold text-forest">{isEdit ? 'Edit listing' : 'New listing'}</h1>
      {!isEdit && (
        <div className="card p-4 mt-4 border-farm/25">
          <div className="font-bold flex items-center gap-2"><Mic size={17} className="text-farm" /> Describe the listing with your voice</div>
          <p className="text-xs text-muted mt-1">
            Say the produce, quantity, price and location. Only spoken values are filled; you still review and publish.
          </p>
          <VoiceInput className="mt-2" label="Speak listing" confirmLabel="Fill listing fields" onConfirm={applyVoice} />
        </div>
      )}
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="card p-6 mt-4 space-y-4">
        <div><label className="label" htmlFor="name">Product name</label><input id="name" className="input" {...register('name')} /><FieldError msg={errors.name?.message} /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label" htmlFor="cat">Category</label>
            <select id="cat" className="input" {...register('category_id')}>
              <option value="">—</option>{(Array.isArray(cats) ? cats : []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="label" htmlFor="unit">Unit</label>
            <select id="unit" className="input" {...register('unit')}>
              {['kg', 'g', 'quintal', 'ton', 'dozen', 'piece', 'litre', 'bag'].map((u) => <option key={u} value={u}>{u}</option>)}
            </select></div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div><label className="label" htmlFor="price">Price (₹)</label><input id="price" type="number" step="0.01" className="input" {...register('price')} /><FieldError msg={errors.price?.message} /></div>
          <div><label className="label" htmlFor="qty">Stock</label><input id="qty" type="number" step="0.01" className="input" {...register('available_quantity')} /><FieldError msg={errors.available_quantity?.message} /></div>
          <div><label className="label" htmlFor="moq">Min order</label><input id="moq" type="number" step="0.01" className="input" {...register('minimum_order_quantity')} /></div>
        </div>
        <div><label className="label" htmlFor="loc">Location</label><input id="loc" className="input" placeholder="e.g. Erode, Tamil Nadu" {...register('location')} /></div>
        <div><label className="label" htmlFor="desc">Description</label><textarea id="desc" rows={3} className="input" {...register('description')} /></div>
        <div>
          <label className="label" htmlFor="image_url">Image URL (or upload)</label>
          <input id="image_url" className="input" {...register('image_url')} placeholder="https://…" />
          <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload product image"
            className="mt-2 text-sm" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }} />
          <p className="text-xs text-muted mt-1">JPG/PNG/WebP under 5 MB. Stored locally in dev.</p>
        </div>
        <button className="btn-primary w-full" disabled={mut.isPending}>{mut.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Publish listing'}</button>
      </form>
    </div>
  )
}
