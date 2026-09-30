import { motion } from 'framer-motion'

export default function NotBuiltPage({ title }: { title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="p-6 md:p-8"
    >
      <h1 className="font-display font-800 text-2xl mb-2">{title}</h1>
      <p className="text-muted text-sm">Not built yet.</p>
    </motion.div>
  )
}
