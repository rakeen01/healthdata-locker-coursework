import { logout } from '@/lib/auth/actions'

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="text-[13px] text-gray-500 transition-colors hover:text-[#1AA7A1]"
      >
        Log out
      </button>
    </form>
  )
}

export function LogoutLinkRow() {
  return (
    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
      <LogoutButton />
    </div>
  )
}
