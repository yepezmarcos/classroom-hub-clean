import CommentGenerator from "@/components/CommentGenerator";

export default function Page() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Comment Generator</h1>
      <CommentGenerator
        // If your API is on a different origin (e.g. localhost:4000), set base:
        // apiBase={process.env.NEXT_PUBLIC_API_BASE}
        onInsert={(text) => {
          // Replace with your student profile textarea hookup:
          console.log("INSERT:", text);
        }}
      />
    </div>
  );
}