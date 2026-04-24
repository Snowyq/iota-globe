import Index from "@/views/Index";

export default async function Page() {
    const data = await fetch("http://localhost:3000/api?dataset=mainnet").then(
        (res) => res.json()
    );

    console.log("Data from API:", data);

    return <Index />;
}
