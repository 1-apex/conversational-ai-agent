import ChatWindow from "@/components/ChatWindow";

export default function Home() {
  return (
    <main className="h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-teal-200/30 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl" />
      <div className="absolute top-[40%] left-[50%] w-64 h-64 bg-violet-200/20 rounded-full blur-3xl" />

      {/* Main chat container */}
      <div className="relative z-10 h-full max-w-4xl mx-auto">
        <ChatWindow />
      </div>
    </main>
  );
}