export default async function Page({ params }) {
  const slug = params?.slug || "no-slug"

  console.log("Slug is:", slug)

  return (
    <div>
      <h1>Slug: {slug}</h1>

      <a href="/">
        <button>Back</button>
      </a>
    </div>
  )
}