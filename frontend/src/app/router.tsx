import { createBrowserRouter, Outlet } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Landing from '../pages/Landing'
import Login from '../pages/Login'
import Register from '../pages/Register'
import Marketplace from '../pages/Marketplace'
import ProductDetails from '../pages/ProductDetails'
import BuyerDashboard from '../pages/BuyerDashboard'
import Cart from '../pages/Cart'
import Checkout from '../pages/Checkout'
import Orders from '../pages/Orders'
import OrderDetails from '../pages/OrderDetails'
import SellerDashboard from '../pages/SellerDashboard'
import ProductForm from '../pages/ProductForm'
import AdminDashboard from '../pages/AdminDashboard'
import Insights from '../pages/Insights'
import Logistics from '../pages/Logistics'
import Notifications from '../pages/Notifications'
import Profile from '../pages/Profile'
import RescueBuyer from '../pages/RescueBuyer'
import RescueSeller from '../pages/RescueSeller'
import RescueDetails from '../pages/RescueDetails'
import SharedTransport from '../pages/SharedTransport'
import ShipmentDetails from '../pages/ShipmentDetails'
import VoiceAssistant from '../pages/VoiceAssistant'
import SellerOnboarding from '../pages/SellerOnboarding'
import NotAllowed from '../pages/NotAllowed'
import { RequireAuth } from '../components/common/guard'
import { Navbar, Footer } from '../components/layout/shell'

function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <Toaster position="bottom-center" />
    </div>
  )
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
  { path: '/', element: <Landing /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/market', element: <Marketplace /> },
  { path: '/products/:id', element: <ProductDetails /> },
  { path: '/not-allowed', element: <NotAllowed /> },
  {
    element: <RequireAuth roles={['buyer']} />,
    children: [
      { path: '/buyer', element: <BuyerDashboard /> },
      { path: '/cart', element: <Cart /> },
      { path: '/checkout', element: <Checkout /> },
      { path: '/rescue', element: <RescueBuyer /> },
    ]
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/orders', element: <Orders /> },
      { path: '/orders/:id', element: <OrderDetails /> },
      { path: '/notifications', element: <Notifications /> },
      { path: '/profile', element: <Profile /> },
      { path: '/insights', element: <Insights /> },
      { path: '/rescue/:id', element: <RescueDetails /> },
      { path: '/transport', element: <SharedTransport /> },
      { path: '/transport/:id', element: <ShipmentDetails /> },
      { path: '/voice', element: <VoiceAssistant /> },
    ]
  },
  {
    element: <RequireAuth roles={['seller']} />,
    children: [
      { path: '/onboarding', element: <SellerOnboarding /> },
      { path: '/seller', element: <SellerDashboard /> },
      { path: '/seller/products/new', element: <ProductForm /> },
      { path: '/seller/products/:id/edit', element: <ProductForm /> },
      { path: '/rescue/manage', element: <RescueSeller /> },
    ]
  },
  {
    element: <RequireAuth roles={['seller', 'admin']} />,
    children: [
      { path: '/logistics', element: <Logistics /> },
    ]
  },
  {
    element: <RequireAuth roles={['admin']} />,
    children: [{ path: '/admin', element: <AdminDashboard /> }]
  },
  { path: '*', element: <div className="max-w-xl mx-auto p-10 text-center"><h1 className="text-2xl font-bold">Page not found</h1><a href="/" className="text-farm font-semibold">Go home</a></div> }
    ]
  }
])
