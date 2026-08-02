import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity()
export class EmailConfirmation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  user: User;

  @Column({ unique: true })
  slug: string;

  @Column()
  code: string;

  @Column()
  expires: Date;
}
