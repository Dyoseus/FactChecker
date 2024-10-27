"use client"
import { useEffect, useState, useRef  } from "react"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSearchParams } from 'next/navigation'


type FactCheckStatus = "Likely True" | "Likely False" | "Mostly False" | "Partially False" | "Unable to Verify"

interface FactCheck {
  statement: string
  result: FactCheckStatus
  explanation: string
}

const initialFactChecks: FactCheck[] = [
  {
    statement: "The Earth is flat.",
    result: "Likely False",
    explanation: "Numerous scientific observations and measurements have conclusively proven that the Earth is roughly spherical."
  },
  {
    statement: "Vaccines cause autism.",
    result: "Likely False",
    explanation: "Extensive scientific research has found no link between vaccines and autism."
  },
  {
    statement: "Drinking water helps maintain overall health.",
    result: "Likely True",
    explanation: "Proper hydration is essential for various bodily functions and overall well-being."
  },
  {
    statement: "Humans only use 10% of their brains.",
    result: "Likely False",
    explanation: "Brain scans have shown that we use most of our brain, even when we're sleeping."
  },
  {
    statement: "Exercise can improve mental health.",
    result: "Likely True",
    explanation: "Regular physical activity has been shown to reduce symptoms of depression and anxiety."
  },
  {
    statement: "Climate change is partially caused by human activities.",
    result: "Mostly False",
    explanation: "While natural factors contribute to climate change, human activities, particularly greenhouse gas emissions, are the dominant cause of observed climate change since the mid-20th century."
  }
]

function getStatusIcon(status: FactCheckStatus) {
  switch (status) {
    case "Likely True":
      return <CheckCircle className="h-6 w-6 text-green-500" />
    case "Likely False":
      return <XCircle className="h-6 w-6 text-red-500" />
    case "Mostly False":
      return <AlertCircle className="h-6 w-6 text-yellow-500" />
    case "Partially False":
      return <AlertCircle className="h-6 w-6 text-yellow-500" />
    case "Unable to Verify":
      return <AlertCircle className="h-6 w-6 text-yellow-500" />
  }
}

function getStatusColor(status: FactCheckStatus) {
  switch (status) {
    case "Likely True":
      return "bg-green-100 text-green-800"
    case "Likely False":
      return "bg-red-100 text-red-800"
    case "Mostly False":
      return "bg-yellow-100 text-yellow-800"
    case "Partially False":
      return "bg-yellow-100 text-yellow-800"
    case "Unable to Verify":
      return "bg-yellow-100 text-yellow-800"
  }
}

export default function FactChecker() {
  const [factChecks, setFactChecks] = useState<FactCheck[]>(initialFactChecks)
  const [inputText, setInputText] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const processedQueries = useRef(new Set<string>())

  const performFactCheck = async (statement: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:8004/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          statement: statement
        })
      })
      const data = await response.json()
      console.log('Response data:', data)

      const newFactCheck: FactCheck = {
        statement: statement,
        result: data.result || "Unable to Verify",
        explanation: data.explanation || "No explanation provided"
      }

      setFactChecks(prevChecks => [newFactCheck, ...prevChecks])
      
    } catch (error) {
      console.error('Error:', error)
      const errorFactCheck: FactCheck = {
        statement: statement,
        result: "Unable to Verify",
        explanation: "An error occurred while checking this fact."
      }
      setFactChecks(prevChecks => [errorFactCheck, ...prevChecks])
    } finally {
      setIsLoading(false)
    }
  }

  // Handle URL query parameter
  useEffect(() => {
    const query = searchParams.get('q')
    
    if (!query || isLoading) return;
    
    // Check if we've already processed this query
    if (!processedQueries.current.has(query)) {
      processedQueries.current.add(query)
      performFactCheck(query)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inputText.trim() && !isLoading) {
      await performFactCheck(inputText)
      setInputText('')
    }
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Fact Checker</CardTitle>
        <CardDescription>
          A history of fact-checked statements
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter a statement to fact check..."
              className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Checking...
                </>
              ) : (
                'Check Fact'
              )}
            </button>
          </div>
        </form>
        
        <ScrollArea className="h-[600px] pr-4">
          {factChecks.map((check, index) => (
            <div key={index} className="mb-6 last:mb-0">
              <div className="flex items-start space-x-4">
                <div className="mt-1">{getStatusIcon(check.result)}</div>
                <div className="flex-1">
                  <p className="font-semibold mb-2">{check.statement}</p>
                  <div className={`inline-block px-2 py-1 rounded-full text-sm font-medium mb-2 ${getStatusColor(check.result)}`}>
                    {check.result}
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 whitespace-pre-line">{check.explanation}</p>
                </div>
              </div>
              {index < factChecks.length - 1 && <hr className="my-4 border-gray-200 dark:border-gray-700" />}
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}