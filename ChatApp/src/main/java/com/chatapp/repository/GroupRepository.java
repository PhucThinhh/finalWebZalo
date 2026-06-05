package com.chatapp.repository;

import com.chatapp.entity.Group;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface GroupRepository extends MongoRepository<Group, String> {

    Optional<Group> findByNameIgnoreCaseAndCreatedBy(String name, Long createdBy);
}