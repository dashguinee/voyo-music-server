import { motion } from 'framer-motion'
import { Flame, Sparkles, Zap, MessageCircle } from 'lucide-react'

// ============================================
// VOYO PORTRAIT MODE - "The Manual Cockpit"
// Designed by GIRO for the African SuperApp
// ============================================

const PortraitVOYO = () => {
  // Mock data for timeline
  const timelineItems = [
    { id: 1, title: 'Wizkid - Essence', cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop', type: 'history' },
    { id: 2, title: 'Burna Boy - Last Last', cover: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=100&h=100&fit=crop', type: 'history' },
    { id: 3, title: 'Tems - Free Mind', cover: 'https://images.unsplash.com/photo-1571974599782-87624638275e?w=100&h=100&fit=crop', type: 'current' },
    { id: 4, title: 'Rema - Calm Down', cover: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=100&h=100&fit=crop', type: 'queue' },
    { id: 5, title: 'Ayra Starr - Rush', cover: 'https://images.unsplash.com/photo-1485579149621-3123dd979885?w=100&h=100&fit=crop', type: 'queue' },
  ]

  // Mock data for streams
  const hotTracks = [
    { id: 1, cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=120&h=120&fit=crop' },
    { id: 2, cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120&h=120&fit=crop' },
    { id: 3, cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=120&h=120&fit=crop' },
    { id: 4, cover: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=120&h=120&fit=crop' },
  ]

  const discoverTracks = [
    { id: 1, cover: 'https://images.unsplash.com/photo-1504898770365-14faca6a7320?w=120&h=120&fit=crop' },
    { id: 2, cover: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=120&h=120&fit=crop' },
    { id: 3, cover: 'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?w=120&h=120&fit=crop' },
    { id: 4, cover: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=120&h=120&fit=crop' },
  ]

  return (
    <div className="min-h-screen w-full bg-[#050507] text-white font-sans overflow-hidden relative">
      {/* Ambient Glow Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-500/15 rounded-full blur-[100px] pointer-events-none" />

      {/* ============================================ */}
      {/* TOP: THE TIMELINE */}
      {/* ============================================ */}
      <section className="pt-6 px-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
          <span className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase">Timeline</span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
          {timelineItems.map((item, index) => (
            <motion.div
              key={item.id}
              whileTap={{ scale: 0.95 }}
              className={`flex-shrink-0 relative ${
                item.type === 'current' ? 'scale-110 z-10' : 'opacity-60'
              }`}
            >
              {/* Card */}
              <div className={`
                rounded-2xl overflow-hidden backdrop-blur-xl border
                ${item.type === 'current'
                  ? 'w-24 h-24 bg-white/10 border-purple-500/50 shadow-lg shadow-purple-500/20'
                  : 'w-16 h-16 bg-white/5 border-white/10'
                }
              `}>
                <img
                  src={item.cover}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                {item.type === 'current' && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                )}
              </div>

              {/* Current indicator */}
              {item.type === 'current' && (
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                />
              )}

              {/* Type indicator */}
              <span className={`
                absolute -top-1 -right-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full
                ${item.type === 'history' ? 'bg-white/10 text-white/40' : ''}
                ${item.type === 'queue' ? 'bg-purple-500/20 text-purple-400' : ''}
                ${item.type === 'current' ? 'hidden' : ''}
              `}>
                {item.type === 'history' && '←'}
                {item.type === 'queue' && '→'}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============================================ */}
      {/* CENTER: THE STAGE */}
      {/* ============================================ */}
      <section className="relative h-72 flex items-center justify-center px-4 my-4">
        {/* Now Playing Card (Left-Center) */}
        <motion.div
          whileTap={{ scale: 0.97 }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-40 h-52 rounded-3xl overflow-hidden
                     backdrop-blur-xl bg-white/5 border border-white/10
                     shadow-2xl shadow-purple-500/10"
        >
          <img
            src="https://images.unsplash.com/photo-1571974599782-87624638275e?w=400&h=500&fit=crop"
            alt="Now Playing"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-[10px] font-bold tracking-[0.2em] text-purple-400 uppercase">Now Playing</p>
            <h3 className="text-lg font-bold mt-1">Free Mind</h3>
            <p className="text-sm text-white/60">Tems</p>
          </div>

          {/* Neon border glow */}
          <div className="absolute inset-0 rounded-3xl border-2 border-purple-500/30 pointer-events-none" />
        </motion.div>

        {/* OYO The Owl Avatar (Center-Front) */}
        <motion.div
          animate={{
            y: [0, -8, 0],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-20"
        >
          {/* Owl Container */}
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-purple-600/30 to-pink-600/30
                          backdrop-blur-xl border border-white/20 flex items-center justify-center
                          shadow-2xl shadow-purple-500/30">
            {/* Owl Face */}
            <div className="relative">
              {/* Eyes */}
              <div className="flex gap-4">
                <motion.div
                  animate={{
                    boxShadow: ['0 0 20px #a855f7', '0 0 40px #a855f7', '0 0 20px #a855f7']
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-purple-600"
                >
                  <div className="w-2 h-2 bg-white rounded-full mt-1 ml-1" />
                </motion.div>
                <motion.div
                  animate={{
                    boxShadow: ['0 0 20px #ec4899', '0 0 40px #ec4899', '0 0 20px #ec4899']
                  }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                  className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-pink-600"
                >
                  <div className="w-2 h-2 bg-white rounded-full mt-1 ml-1" />
                </motion.div>
              </div>
              {/* Beak */}
              <div className="w-4 h-3 bg-gradient-to-b from-yellow-400 to-orange-500
                              mx-auto mt-2 rounded-b-full"
                   style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} />
            </div>
          </div>

          {/* OYO Label */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2
                          px-3 py-1 rounded-full bg-white/10 backdrop-blur-xl border border-white/20">
            <span className="text-xs font-bold tracking-wider">OYO</span>
          </div>
        </motion.div>

        {/* Next Up Card (Right-Center, Smaller) */}
        <motion.div
          whileTap={{ scale: 0.97 }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-32 h-44 rounded-2xl overflow-hidden
                     backdrop-blur-xl bg-white/5 border border-white/10 opacity-70"
        >
          <img
            src="https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&h=400&fit=crop"
            alt="Next Up"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-[9px] font-bold tracking-[0.2em] text-pink-400 uppercase">Next Up</p>
            <h3 className="text-sm font-bold mt-0.5">Calm Down</h3>
            <p className="text-xs text-white/60">Rema</p>
          </div>
        </motion.div>
      </section>

      {/* ============================================ */}
      {/* REACTION BAR (Floating) */}
      {/* ============================================ */}
      <section className="flex justify-center gap-3 mb-6">
        {[
          { label: 'OYO', icon: <Zap className="w-3 h-3" />, color: 'from-purple-500 to-purple-600' },
          { label: 'OYÉÉ', icon: <Flame className="w-3 h-3" />, color: 'from-pink-500 to-red-500' },
          { label: 'Wazzguán', icon: <MessageCircle className="w-3 h-3" />, color: 'from-blue-500 to-cyan-500' },
        ].map((reaction) => (
          <motion.button
            key={reaction.label}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            className={`
              flex items-center gap-1.5 px-4 py-2 rounded-full
              bg-gradient-to-r ${reaction.color}
              backdrop-blur-xl border border-white/20
              text-xs font-bold tracking-wide
              shadow-lg shadow-purple-500/10
            `}
          >
            {reaction.icon}
            <span>{reaction.label}</span>
          </motion.button>
        ))}
      </section>

      {/* ============================================ */}
      {/* BOTTOM: THE FLOW (Split Streams) */}
      {/* ============================================ */}
      <section className="relative h-44 flex items-center">
        {/* HOT Stream (Left -> Center) */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center">
          {/* Label */}
          <div className="flex flex-col items-center px-3">
            <Flame className="w-5 h-5 text-orange-500 mb-1" />
            <span className="text-[9px] font-bold tracking-[0.2em] text-orange-400 uppercase">Hot</span>
          </div>

          {/* Stream */}
          <div className="flex gap-2">
            {hotTracks.map((track, index) => (
              <motion.div
                key={track.id}
                whileTap={{ scale: 0.95 }}
                style={{
                  opacity: 1 - (index * 0.2),
                  scale: 1 - (index * 0.05)
                }}
                className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 border border-white/10
                           shadow-lg shadow-orange-500/10"
              >
                <img
                  src={track.cover}
                  alt="Track"
                  className="w-full h-full object-cover"
                />
              </motion.div>
            ))}
          </div>

          {/* Fade overlay */}
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#050507] to-transparent pointer-events-none" />
        </div>

        {/* VOYO ORB (Center Portal) */}
        <motion.button
          onClick={() => console.log('Enter Feed')}
          animate={{
            scale: [1, 1.08, 1],
            boxShadow: [
              '0 0 30px rgba(168, 85, 247, 0.4), 0 0 60px rgba(236, 72, 153, 0.2)',
              '0 0 50px rgba(168, 85, 247, 0.6), 0 0 100px rgba(236, 72, 153, 0.4)',
              '0 0 30px rgba(168, 85, 247, 0.4), 0 0 60px rgba(236, 72, 153, 0.2)',
            ]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          whileTap={{ scale: 0.95 }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30
                     w-20 h-20 rounded-full
                     bg-gradient-to-br from-purple-600 via-pink-600 to-purple-600
                     border-2 border-white/30
                     flex items-center justify-center
                     cursor-pointer"
        >
          {/* Inner glow */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/20 to-transparent" />

          {/* VOYO Text */}
          <span className="text-sm font-black tracking-widest relative z-10">VOYO</span>

          {/* Outer ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-2 rounded-full border border-dashed border-purple-500/50"
          />
        </motion.button>

        {/* DISCOVER Stream (Center -> Right) */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center flex-row-reverse">
          {/* Label */}
          <div className="flex flex-col items-center px-3">
            <Sparkles className="w-5 h-5 text-cyan-400 mb-1" />
            <span className="text-[9px] font-bold tracking-[0.2em] text-cyan-400 uppercase">Discover</span>
          </div>

          {/* Stream */}
          <div className="flex gap-2 flex-row-reverse">
            {discoverTracks.map((track, index) => (
              <motion.div
                key={track.id}
                whileTap={{ scale: 0.95 }}
                style={{
                  opacity: 1 - (index * 0.2),
                  scale: 1 - (index * 0.05)
                }}
                className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 border border-white/10
                           shadow-lg shadow-cyan-500/10"
              >
                <img
                  src={track.cover}
                  alt="Track"
                  className="w-full h-full object-cover"
                />
              </motion.div>
            ))}
          </div>

          {/* Fade overlay */}
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#050507] to-transparent pointer-events-none" />
        </div>
      </section>

      {/* Bottom safe area */}
      <div className="h-8" />
    </div>
  )
}

export default PortraitVOYO
