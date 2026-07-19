import dataSource from './data-source';
import { Resort } from './entity/resort.entity';
import { Faq } from './entity/faq.entity';
import { ResortFeature } from './entity/resort-feature.entity';
import { ResortContact, ContactType } from './entity/resort-contact.entity';
import { Reservation, ReservationStatus } from './entity/reservation.entity';

const RESORT_PHONE_NUMBER = '1211777188687734';

const RESORT_DETAILS = {
    address: 'Paradise Beach bb, 85310 Budva, Montenegro',
    latitude: 42.2864,
    longitude: 18.84,
    startWorkingHours: '08:00',
    endWorkingHours: '22:00',
    website: 'https://sunsetbayresort.example.com',
};

const FAQS: Array<{ question: string; answer: string }> = [
    {
        question: 'Where is the resort located?',
        answer: 'Sunset Bay Resort sits right on Paradise Beach in Budva, Montenegro, with direct waterfront access.',
    },
    {
        question: 'What time is check-in and check-out?',
        answer: 'Check-in starts at 2:00 PM and check-out is until 11:00 AM.',
    },
    {
        question: 'Is breakfast included?',
        answer: 'Yes, breakfast is included with every room and is served from 7:00 AM to 10:30 AM.',
    },
    {
        question: 'Do you have a swimming pool?',
        answer: 'Yes, we have an outdoor infinity pool open from 8:00 AM to 8:00 PM, plus direct beach access.',
    },
    {
        question: 'Is parking available?',
        answer: 'Yes, free private parking is available on-site for all guests.',
    },
];

const FEATURES: Array<{ name: string; description: string; price: number; quantity: number; images: string[] }> = [
    {
        name: 'Private Cabana',
        description: 'A private beachfront cabana for two, with sun loungers and shade.',
        price: 49.99,
        quantity: 6,
        images: ['https://bucket.example.com/cabana-1.jpg'],
    },
    {
        name: 'Deluxe Sea View Room',
        description: 'A double room with a private balcony overlooking Paradise Beach.',
        price: 129.0,
        quantity: 10,
        images: ['https://bucket.example.com/deluxe-room-1.jpg'],
    },
    {
        name: 'Jet Ski Rental (1 hour)',
        description: 'One hour of guided jet ski rental along the coast.',
        price: 65.0,
        quantity: 3,
        images: [],
    },
];

const CONTACTS: Array<{ contact_name: string; type: ContactType; contact: string }> = [
    { contact_name: 'Front Desk', type: ContactType.PHONE, contact: '+382 69 123 456' },
    { contact_name: 'Reservations', type: ContactType.EMAIL, contact: 'reservations@sunsetbayresort.example.com' },
];

async function seed() {
    await dataSource.initialize();

    const resortRepo = dataSource.getRepository(Resort);
    const faqRepo = dataSource.getRepository(Faq);
    const featureRepo = dataSource.getRepository(ResortFeature);
    const contactRepo = dataSource.getRepository(ResortContact);
    const reservationRepo = dataSource.getRepository(Reservation);

    let resort = await resortRepo.findOne({ where: { phoneNumber: RESORT_PHONE_NUMBER } });
    if (!resort) {
        resort = await resortRepo.save(
            resortRepo.create({ name: 'Sunset Bay Resort', phoneNumber: RESORT_PHONE_NUMBER, ...RESORT_DETAILS }),
        );
        console.log(`Created resort "${resort.name}" (${resort.phoneNumber})`);
    } else {
        console.log(`Resort "${resort.name}" (${resort.phoneNumber}) already exists`);
    }

    let detailsChanged = false;
    if (!resort.address) { resort.address = RESORT_DETAILS.address; detailsChanged = true; }
    if (!resort.latitude) { resort.latitude = RESORT_DETAILS.latitude; detailsChanged = true; }
    if (!resort.longitude) { resort.longitude = RESORT_DETAILS.longitude; detailsChanged = true; }
    if (!resort.startWorkingHours) { resort.startWorkingHours = RESORT_DETAILS.startWorkingHours; detailsChanged = true; }
    if (!resort.endWorkingHours) { resort.endWorkingHours = RESORT_DETAILS.endWorkingHours; detailsChanged = true; }
    if (!resort.website) { resort.website = RESORT_DETAILS.website; detailsChanged = true; }
    if (detailsChanged) {
        resort = await resortRepo.save(resort);
        console.log('  + Filled in missing resort details (address/coordinates/hours/website)');
    }

    for (const faq of FAQS) {
        const exists = await faqRepo.findOne({
            where: { question: faq.question, resort: { id: resort.id } },
            relations: { resort: true },
        });
        if (!exists) {
            await faqRepo.save(faqRepo.create({ ...faq, resort }));
            console.log(`  + FAQ: ${faq.question}`);
        }
    }

    const seededFeatures: ResortFeature[] = [];
    for (const feature of FEATURES) {
        let existing = await featureRepo.findOne({
            where: { name: feature.name, resort: { id: resort.id } },
            relations: { resort: true },
        });
        if (!existing) {
            existing = await featureRepo.save(featureRepo.create({ ...feature, resort }));
            console.log(`  + Feature: ${feature.name}`);
        }
        seededFeatures.push(existing);
    }

    for (const contact of CONTACTS) {
        const exists = await contactRepo.findOne({
            where: { contact_name: contact.contact_name, type: contact.type, resort: { id: resort.id } },
            relations: { resort: true },
        });
        if (!exists) {
            await contactRepo.save(contactRepo.create({ ...contact, resort }));
            console.log(`  + Contact: ${contact.contact_name} (${contact.type})`);
        }
    }

    const hasReservation = await reservationRepo.findOne({
        where: { feature: { resort: { id: resort.id } } },
        relations: { feature: true },
    });
    if (!hasReservation && seededFeatures.length > 0) {
        const sampleFeature = seededFeatures[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 3);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 2);

        await reservationRepo.save(
            reservationRepo.create({
                feature: sampleFeature,
                status: ReservationStatus.PENDING,
                startDate,
                endDate,
                phoneNumber: '38269280401',
            }),
        );
        console.log(`  + Sample reservation for "${sampleFeature.name}"`);
    }

    await dataSource.destroy();
    console.log('Seed complete.');
}

seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
