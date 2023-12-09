import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string

  @Column({ nullable: true })
  full_name: string

  @Column()
  email: string

  @Column({ nullable: true })
  avatar: string
}