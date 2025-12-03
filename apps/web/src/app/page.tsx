'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">BotMarket</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-gray-700 hover:text-gray-900 px-3 py-2">
                Home
              </Link>
              <Link href="/create" className="text-gray-700 hover:text-gray-900 px-3 py-2">
                Create Bot
              </Link>
              <Link href="/marketplace" className="text-gray-700 hover:text-gray-900 px-3 py-2">
                Marketplace
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to BotMarket
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Create and manage Polymarket trading bots with ease
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/create"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Create Your First Bot
            </Link>
              <Link
              href="/marketplace"
              className="bg-gray-200 text-gray-900 px-6 py-3 rounded-lg hover:bg-gray-300 transition"
            >
              Browse Marketplace
            </Link>
            <Link
              href="/tradingview-setup"
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition"
            >
              TradingView Setup Guide
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

