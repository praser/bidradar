import { getOffers } from './src/cef/index.js'
import { closeDb } from './src/db/index.js'
import { createOfferRepository } from './src/db/offerRepository.js'
import { reconcileOffers } from './src/core/reconcileOffers.js'

async function main() {
  const offers = await getOffers()
  const repo = createOfferRepository()
  await reconcileOffers(offers, repo)
}

main()
  .then(async () => {
    console.log('Done persisting offers.')
    await closeDb()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error(err)
    await closeDb()
    process.exit(1)
  })
