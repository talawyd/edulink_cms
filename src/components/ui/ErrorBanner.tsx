export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-danger-muted text-danger text-sm rounded-lg px-4 py-3 border border-danger/20">
      {message}
    </div>
  )
}
